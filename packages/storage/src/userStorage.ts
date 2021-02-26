/* eslint-disable no-await-in-loop */
import { DecryptedUserMessage, Mailbox } from '@spacehq/mailbox';
import { GetAddressFromPublicKey, Identity, SpaceUser } from '@spacehq/users';
import { authenticateSpaceIdentity, tryParsePublicKey } from '@spacehq/utils';
import { PrivateKey } from '@textile/crypto';
import { Buckets, Client, PathAccessRole, PathItem, Root, ThreadID, UserAuth } from '@textile/hub';
import dayjs from 'dayjs';
import ee from 'event-emitter';
import { flattenDeep } from 'lodash';
import Pino from 'pino';
import { v4 } from 'uuid';
import { DirEntryNotFoundError, FileNotFoundError, UnauthenticatedError } from './errors';
import { Listener } from './listener/listener';
import { GundbMetadataStore } from './metadata/gundbMetadataStore';
import { BucketMetadata, FileMetadata, SharedFileMetadata, UserMetadataStore } from './metadata/metadataStore';
import { createFileInvitations } from './sharing/sharing';
import { AcceptInvitationResponse,
  AddItemsRequest,
  AddItemsResponse,
  AddItemsResultSummary,
  AddItemsStatus,
  CreateFolderRequest,
  DirectoryEntry,
  FileMember,
  FullPath,
  GetFilesSharedByMeResponse,
  GetFilesSharedWithMeResponse,
  GetNotificationsResponse,
  GetRecentlySharedWithResponse,
  Invitation,
  InvitationStatus,
  ListDirectoryRequest,
  ListDirectoryResponse,
  MakeFilePublicRequest,
  Notification,
  NotificationSubscribeResponse,
  NotificationType,
  OpenFileRequest,
  OpenFileResponse,
  OpenUuidFileRequest,
  OpenUuidFileResponse,
  SharedWithMeFiles,
  ShareKeyType,
  SharePublicKeyInput,
  SharePublicKeyOutput,
  ShareViaPublicKeyRequest,
  ShareViaPublicKeyResponse,
  TxlSubscribeResponse } from './types';
import { validateNonEmptyArray } from './utils/assertUtils';
import { isMetaFileName } from './utils/fsUtils';
import { filePathFromIpfsPath,
  getParentPath,
  isTopLevelPath,
  reOrderPathByParents,
  sanitizePath } from './utils/pathUtils';
import { consumeStream } from './utils/streamUtils';
import { getDeterministicThreadID } from './utils/threadsUtils';

export interface UserStorageConfig {
  textileHubAddress?: string;
  /**
   * Optional initializer of a bucket from textiles users auth
   * can be use to override/provide custom initialization logic
   *
   * The default value will be Textiles Buckets.withUserAuth
   * @param auth - Textile UserAuth object to initialize bucket
   */
  bucketsInit?: (auth: UserAuth) => Buckets;
  threadsInit?: (auth: UserAuth) => Client;
  metadataStoreInit?: (identity: Identity) => Promise<UserMetadataStore>;
  /**
   * If set to true, would enable logging and some other debugging features.
   * Should only be set to true in development
   *
   */
  debugMode?: boolean;
}

const DefaultTextileHubAddress = 'https://webapi.hub.textile.io';

interface BucketMetadataWithThreads extends BucketMetadata {
  root?: Root
  threadId?: string;
}

/**
 * UserStorage performs storage actions on behalf of the user provided.
 *
 * @example
 * ```typescript
 * const spaceStorage = new UserStorage(spaceUser);
 *
 * // create an empty folder
 * await spaceStorage.createFolder({
 *   bucket: 'personal',
 *   path: '/cool'
 * });
 * ```
 */
export class UserStorage {
  // private field to cache created store
  // use the metadataStore getter to access this
  private userMetadataStore?: UserMetadataStore;

  private listener?:Listener;

  private mailbox?: Mailbox;

  private logger: Pino.Logger;

  constructor(private readonly user: SpaceUser, private readonly config: UserStorageConfig = {}) {
    this.config.textileHubAddress = config.textileHubAddress ?? DefaultTextileHubAddress;
    this.logger = Pino({
      enabled: config.debugMode || false,
      // prettyPrint: true,
    }).child({ pk: user.identity.public.toString() });
  }

  /**
   * Creates the listener post constructor
   *
   * @remarks
   * - This should be called after the constructor if txlSubscribe will be users
   */
  public async initListener():Promise<void> {
    const metadataStore = await this.getMetadataStore();
    const buckets = await metadataStore.listBuckets();
    const ids = buckets.map((bucket) => bucket.dbId);
    const threadsClient = this.getUserThreadsClient();
    this.listener = new Listener(ids, threadsClient);
  }

  /**
   * Setup mailbox
   *
   * @remarks
   * - This should be called after the constructor if sharing functionalities are to be used
   */
  public async initMailbox():Promise<void> {
    this.mailbox = await this.initMailboxForUser(this.user);
  }

  private async initMailboxForUser(user: SpaceUser): Promise<Mailbox> {
    return Mailbox.createMailbox(user, {
      textileHubAddress: this.config.textileHubAddress,
    }, UserStorage.parseMsg);
  }

  /**
   * Sync the notifications from the temp key with the current space user of this storage.
   *
   * This is useful for new users who have some pending invitation assigned to the notification.
   *
   * @param key - temp key gotten from ShareViaPublicKey
   */
  async syncFromTempKey(key: string): Promise<void> {
    const { tempSpaceUser, tempUserMailbox } = await this.authenticateTempUser(key);

    const msgs: DecryptedUserMessage[] | undefined = await tempUserMailbox.listInboxMessages();
    if (!msgs) {
      this.logger.info('TempKey\'s inbox is empty no syncing necessary');
      return;
    }
    this.logger.info({ msgs }, 'TempKey\'s existing inboxes');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tempUserClient = this.initBucket(tempSpaceUser.storageAuth!);
    if (!this.mailbox) {
      await this.initMailbox();
    }

    await Promise.all(msgs.map(async (msg) => {
      await this.syncTempUsersMessageWithUser(msg, tempSpaceUser, tempUserClient, tempUserMailbox);
    }));
  }

  private async authenticateTempUser(key: string) {
    const tempKeyIdentity = PrivateKey.fromString(key);
    const tempUserAuth = await authenticateSpaceIdentity(this.user.endpoint, tempKeyIdentity);
    const tempSpaceUser = {
      ...tempUserAuth,
      endpoint: this.user.endpoint,
      identity: tempKeyIdentity,
    };
    const tempUserMailbox = await this.initMailboxForUser(tempSpaceUser);
    return { tempSpaceUser, tempUserMailbox };
  }

  private async syncTempUsersMessageWithUser(
    msg: DecryptedUserMessage,
    tempSpaceUser: SpaceUser,
    tempUserClient: Buckets,
    tempUserMailbox: Mailbox,
  ) {
    const tempUsersPublicKey = tempSpaceUser.identity.public.toString();
    const currentUsersPublicKey = this.user.identity.public.toString();
    let bodyToBeForwarded = msg.body;
    const notification = await UserStorage.parseMsg(msg);

    if (notification.type === NotificationType.INVITATION) {
      const invitation = notification.relatedObject as Invitation;

      // swap access roles to new user
      await Promise.all(invitation.itemPaths.map(async (ivPaths) => {
        const roles = new Map<string, PathAccessRole>();
        roles.set(currentUsersPublicKey, PathAccessRole.PATH_ACCESS_ROLE_ADMIN);
        roles.set(tempUsersPublicKey, PathAccessRole.PATH_ACCESS_ROLE_UNSPECIFIED);

        tempUserClient.withThread(ivPaths.dbId);
        await tempUserClient.pushPathAccessRoles(ivPaths.bucketKey || '', ivPaths.path, roles);
      }));

      // re-map relevant parameters
      invitation.inviteePublicKey = currentUsersPublicKey;
      bodyToBeForwarded = new TextEncoder().encode(JSON.stringify({
        type: notification.type,
        body: invitation,
      }));
    }

    // forwarding message to user
    await tempUserMailbox.sendMessage(currentUsersPublicKey, bodyToBeForwarded);
    await tempUserMailbox.deleteMessage(msg.id);
  }

  /**
   * Creates an empty folder at the requested path and bucket.
   *
   * @remarks
   * - It throws if an error occurred while creating the folder
   */
  public async createFolder(request: CreateFolderRequest): Promise<void> {
    const client = this.getUserBucketsClient();

    const bucket = await this.getOrCreateBucket(client, request.bucket);
    const file = {
      path: `${sanitizePath(request.path.trimStart())}/.keep`,
      content: Buffer.from(''),
    };

    await client.pushPath(bucket.root?.key || '', '.keep', file);
  }

  private static async addMembersToPathItems(
    items:DirectoryEntry[],
    client:Buckets,
    store: UserMetadataStore,
    bucketKey?: string,
  ): Promise<DirectoryEntry[]> {
    if (items.length === 0) {
      return [];
    }

    const newItems = items;
    let key = bucketKey;

    if (!key) {
      const bucketData = await store.findBucket(items[0].bucket);
      if (!bucketData) {
        throw new Error('Unable to find bucket metadata');
      }
      key = bucketData?.bucketKey;
    }

    for (let i = 0; i < newItems.length; i += 1) {
      const ms = await client.pullPathAccessRoles(key, newItems[i].path);

      if (ms) {
        const members: FileMember[] = [];

        ms.forEach((v, k) => {
          members.push({
            publicKey: k === '*' ? '*' : Buffer.from(tryParsePublicKey(k).pubKey).toString('hex'),
            address: k === '*' ? '' : GetAddressFromPublicKey(k),
            role: v,
          });
        });

        newItems[i].members = members;

        if ((newItems[i]?.items?.length || 0) > 0) {
          newItems[i].items = await this.addMembersToPathItems(
            newItems[i].items as DirectoryEntry[],
            client,
            store,
            key,
          );
        }
      }
    }

    return newItems;
  }

  private static parsePathItems(
    its: PathItem[],
    metadataMap: Record<string, FileMetadata>,
    bucket: string,
    dbId: string,
  ): DirectoryEntry[] {
    const filteredEntries = its.filter((it:PathItem) => !isMetaFileName(it.name));

    const des:DirectoryEntry[] = filteredEntries.map((it: PathItem) => {
      const path = filePathFromIpfsPath(it.path);

      if (!path) {
        throw new Error('Unable to regex parse the path');
      }

      if (!it.metadata || !it.metadata.updatedAt) {
        throw new Error('Unable to parse updatedAt from bucket file');
      }

      const { name, isDir, count } = it;

      // need to divide because textile gives nanoseconds
      const dt = new Date(Math.round(it.metadata.updatedAt / 1000000));
      // using moment to get required output format 2021-01-12T22:57:34-05:00
      const d = dayjs(dt);

      return ({
        name,
        isDir,
        count,
        path,
        ipfsHash: it.cid,
        sizeInBytes: it.size,
        // using the updated date as weare in the daemon, should
        // change once createdAt is available
        created: d.format(),
        updated: d.format(),
        fileExtension: it.name.indexOf('.') >= 0 ? it.name.substr(it.name.lastIndexOf('.') + 1) : '',
        isLocallyAvailable: false,
        backupCount: 1,
        members: [],
        isBackupInProgress: false,
        isRestoreInProgress: false,
        uuid: metadataMap[path]?.uuid || '',
        items: UserStorage.parsePathItems(it.items, metadataMap, bucket, dbId),
        bucket,
        dbId,
      });
    });

    return des;
  }

  /**
   * txlSubscribe is used to listen for Textile events.
   *
   * It listens to all buckets for the user and produces an event when something changes in the bucket.
   *
   * TODO: try to make the event more granular so we can pick up specific files/folders
   *
   * @example
   * ```typescript
   * const spaceStorage = new UserStorage(spaceUser);
   * await spaceStorage.initListener();
   *
   * const response = await spaceStorage.txlSubscribe();
   *
   * response.on('data', (data: TxlSubscriveEvent) => {
   *  const { bucketName } = data as AddItemsStatus;
   *  // bucketName would be the name of the bucket
   * });
   * ```
   */
  public async txlSubscribe(): Promise<TxlSubscribeResponse> {
    const client = this.getUserBucketsClient();
    // const bucket = await this.(client, request.bucket);
    const emitter = ee();

    if (!this.listener) {
      throw new Error('Listener not initialized');
    }

    // using setImmediate here to ensure a cycle is skipped
    // giving the caller a chance to listen to emitter in time to not
    // miss an early data or error event
    // setImmediate(() => {
    this.listener?.subscribe(emitter);
    // });

    return emitter;
  }

  /**
   * NotificationSubscribe is used to listen for Mailbox events.
   *
   * It listens to the users mailbox events, enriches the message with Space specific data.
   *
   *
   * @example
   * ```typescript
   * const spaceStorage = new UserStorage(spaceUser);
   * await spaceStorage.initListener();
   *
   * const response = await spaceStorage.notificationSubscribe();
   *
   * response.on('data', (data: NotificationSubscribeEvent) => {
   *  const { notification: { relatedObject } } = data as Notification;
   *  console.log('file invitation: ', relatedObject);
   * });
   * ```
   */
  public async notificationSubscribe(): Promise<NotificationSubscribeResponse> {
    const client = this.getUserBucketsClient();
    // const bucket = await this.(client, request.bucket);
    const emitter = ee();

    if (!this.mailbox) {
      await this.initMailbox();
    }

    // using setImmediate here to ensure a cycle is skipped
    // giving the caller a chance to listen to emitter in time to not
    // miss an early data or error event
    // setImmediate(() => {
    this.mailbox?.subscribe(emitter);
    // });

    return emitter;
  }

  /**
   * Returns all bucket entries at the specified path.
   *
   * @example
   * ```typescript
   * const spaceStorage = new UserStorage(spaceUser);
   * const response = await spaceStorage.listDirectory({ bucket: 'personal', path: ''});
   *
   * console.log(response.items); // print items in repository
   * ```
   */
  public async listDirectory(request: ListDirectoryRequest): Promise<ListDirectoryResponse> {
    const client = this.getUserBucketsClient();
    const bucket = await this.getOrCreateBucket(client, request.bucket);
    const path = sanitizePath(request.path);
    const store = await this.getMetadataStore();

    const depth = request.recursive ? Number.MAX_SAFE_INTEGER : 0;
    try {
      const result = await client.listPath(bucket.root?.key || '', path, depth);

      if (!result.item || !result.item.items) {
        return {
          items: [],
        };
      }

      const uuidMap = await this.getFileMetadataMap(bucket.slug, bucket.dbId, result.item?.items || []);

      const items = UserStorage.parsePathItems(result.item?.items || [], uuidMap, bucket.slug, bucket.dbId) || [];
      const itemsWithMembers = await UserStorage.addMembersToPathItems(items, client, store);
      return {
        items: itemsWithMembers,
      };
    } catch (e) {
      if (e.message.includes('no link named')) {
        throw new DirEntryNotFoundError(path, request.bucket);
      } else {
        throw e;
      }
    }
  }

  /**
   * openFile returns a stream (AsyncIterableIterator) of the file at the path in the bucket.
   *
   * @example
   * ```typescript
   * const spaceStorage = new UserStorage(spaceUser);
   *
   * const response = await spaceStorage.openFile({ bucket: 'personal', path: '/file.txt' });
   * // response.stream is an async iterable
   * for await (const chunk of response.stream) {
   *    // aggregate the chunks based on your logic
   * }
   *
   * // response also contains a convenience function consumeStream
   * const fileBytes = await response.consumeStream();
   * ```
   */
  public async openFile(request: OpenFileRequest): Promise<OpenFileResponse> {
    const metadataStore = await this.getMetadataStore();
    const client = this.getUserBucketsClient();
    const bucket = await this.getOrCreateBucket(client, request.bucket);
    const path = sanitizePath(request.path);
    const fileMetadata = await metadataStore.findFileMetadata(bucket.slug, bucket.dbId, path);

    try {
      const fileData = client.pullPath(bucket.root?.key || '', path, { progress: request.progress });
      return {
        stream: fileData,
        consumeStream: () => consumeStream(fileData),
        mimeType: fileMetadata?.mimeType,
      };
    } catch (e) {
      if (e.message.includes('no link named')) {
        throw new DirEntryNotFoundError(path, request.bucket);
      } else {
        throw e;
      }
    }
  }

  /**
   * Open a file with uuid. Will only return a result if the current user
   * has access to the file.
   *
   * See the sharing guide for a use case of how this method will be useful.
   *
   * @example
   * ```typescript
   * const spaceStorage = new UserStorage(spaceUser);
   *
   * const response = await spaceStorage.openFileByUuid({
   *    uuid: 'file-uu-id',
   * });
   * const filename = response.entry.name;
   *
   * // response.stream is an async iterable
   * for await (const chunk of response.stream) {
   *    // aggregate the chunks based on your logic
   * }
   *
   * // response also contains a convenience function consumeStream
   * const fileBytes = await response.consumeStream();
   *```
   *
   */
  public async openFileByUuid(request: OpenUuidFileRequest): Promise<OpenUuidFileResponse> {
    const metadataStore = await this.getMetadataStore();
    const client = this.getUserBucketsClient();
    const fileMetadata = await metadataStore.findFileMetadataByUuid(request.uuid);
    if (!fileMetadata) {
      throw new FileNotFoundError();
    }

    this.logger.info({ fileMetadata }, 'Opening file by uuid');
    try {
      client.withThread(fileMetadata.dbId);
      const bucketKey = fileMetadata.bucketKey || '';
      // fetch entry information
      const existingFile = await client.listPath(bucketKey, fileMetadata.path);
      if (!existingFile.item) {
        throw new FileNotFoundError();
      }

      const [fileEntry] = UserStorage.parsePathItems(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        [existingFile.item!],
        { [fileMetadata.path]: fileMetadata },
        fileMetadata.bucketSlug,
        fileMetadata.dbId,
      );

      const fileData = client.pullPath(bucketKey, fileMetadata.path, { progress: request.progress });

      const [fileEntryWithmembers] = await UserStorage.addMembersToPathItems(
        [fileEntry],
        client,
        metadataStore,
        fileMetadata.bucketKey,
      );
      return {
        stream: fileData,
        consumeStream: () => consumeStream(fileData),
        mimeType: fileMetadata.mimeType,
        entry: fileEntryWithmembers,
      };
    } catch (e) {
      if (e.message.includes('no link named')) {
        throw new DirEntryNotFoundError(fileMetadata.path, fileMetadata.bucketSlug);
      } else {
        throw e;
      }
    }
  }

  /**
   * Allow or revoke public access to a file.
   *
   * @example
   * ```typescript
   * const spaceStorage = new UserStorage(spaceUser);
   *
   * await spaceStorage.setFilePublicAccess({
   *    bucket: 'personal',
   *    path: '/file.txt',
   *    allowAccess: true, // <- set to false to revoke public access
   * });
   * ```
   */
  public async setFilePublicAccess(request: MakeFilePublicRequest): Promise<void> {
    const metadataStore = await this.getMetadataStore();
    const client = this.getUserBucketsClient();
    const path = sanitizePath(request.path);
    let metadata: FileMetadata | undefined;
    if (request.dbId) {
      metadata = await metadataStore.findFileMetadata(request.bucket, request.dbId, path);
      client.withThread(request.dbId);
    } else {
      const bucket = await this.getOrCreateBucket(client, request.bucket);
      metadata = await metadataStore.findFileMetadata(request.bucket, bucket.dbId, path);
    }

    this.logger.info({ metadata, request }, 'Request setFilePublicAccess');
    if (metadata === undefined) {
      throw new DirEntryNotFoundError(path, request.bucket);
    }

    const roles = new Map();
    if (request.allowAccess) {
      await metadataStore.setFilePublic(metadata);
      roles.set('*', PathAccessRole.PATH_ACCESS_ROLE_WRITER);
    } else {
      roles.set('*', PathAccessRole.PATH_ACCESS_ROLE_UNSPECIFIED);
    }

    await client.pushPathAccessRoles(metadata.bucketKey || '', path, roles);
  }

  /**
   * addItems is used to upload files to buckets.
   *
   * It uses an ReadableStream of Uint8Array data to read each files content to be uploaded.
   *
   * Uploads will sequential and asynchronous with updates being delivered through the
   * event emitter returned by the function.
   *
   * @example
   * ```typescript
   * const spaceStorage = new UserStorage(spaceUser);
   *
   * const response = await spaceStorage.addItems({
   *   bucket: 'personal',
   *   files: [
   *     {
   *       path: 'file.txt',
   *       content: '',
   *       mimeType: 'plain/text',
   *     },
   *     {
   *       path: 'space.png',
   *       content: '',
   *       mimeType: 'image/png',
   *     }
   *   ],
   * });
   *
   * response.on('data', (data: AddItemsEventData) => {
   *  const status = data as AddItemsStatus;
   *  // update event on how each file is uploaded
   * });
   *
   * response.on('error', (err: AddItemsEventData) => {
   *  const status = data as AddItemsStatus;
   *  // error event if a file upload fails
   *  // status.error contains the error
   * });
   *
   * response.once('done', (data: AddItemsEventData) => {
   *  const summary = data as AddItemsResultSummary;
   *  // returns a summary of all files and their upload status
   * });
   * ```
   */
  public async addItems(request: AddItemsRequest): Promise<AddItemsResponse> {
    const client = this.getUserBucketsClient();
    const bucket = await this.getOrCreateBucket(client, request.bucket);
    const emitter = ee();

    // using setImmediate here to ensure a cycle is skipped
    // giving the caller a chance to listen to emitter in time to not
    // miss an early data or error event
    setImmediate(() => {
      this.uploadMultipleFiles(request, client, bucket, emitter).then((summary) => {
        emitter.emit('done', summary);
      });
    });

    return emitter;
  }

  // eslint-disable-next-line class-methods-use-this
  private async uploadMultipleFiles(
    request: AddItemsRequest,
    client: Buckets,
    bucket: BucketMetadataWithThreads,
    emitter: ee.Emitter,
  ): Promise<AddItemsResultSummary> {
    const metadataStore = await this.getMetadataStore();
    const rootKey = bucket.root?.key || '';
    const summary: AddItemsResultSummary = {
      bucket: request.bucket,
      files: [],
    };

    const reOrderedFiles = reOrderPathByParents(request.files, (it) => it.path);

    await reOrderedFiles.traverseLevels(async (dirFiles) => {
      // NOTE it is safe to use dirFiles[0].path because:
      // - dirFiles is guaranteed to be non-empty by traverseLevels
      // - all files in dirFiles would be in the same directory
      if (!isTopLevelPath(dirFiles[0].path)) {
        const parentPath = getParentPath(dirFiles[0].path);
        const status: AddItemsStatus = {
          path: parentPath,
          status: 'success',
        };
        this.logger.info({ path: parentPath }, 'Uploading parent directory');

        try {
          await this.createFolder({
            bucket: request.bucket,
            path: parentPath,
          });

          // set folder entry
          const newFolder = await client.listPath(rootKey, parentPath);
          const [folderEntry] = UserStorage.parsePathItems(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            [newFolder.item!],
            {},
            bucket.slug,
            bucket.dbId,
          );
          const [folderEntryWithmembers] = await UserStorage.addMembersToPathItems(
            [folderEntry],
            client,
            metadataStore,
          );
          status.entry = folderEntryWithmembers;

          emitter.emit('data', status);
          summary.files.push(status);
        } catch (err) {
          status.status = 'error';
          status.error = err;
          emitter.emit('error', status);
          summary.files.push(status);

          // TODO: since root folder creation failed
          // should automatically fail all subsequent uploads
          // looking forward to community fixing this
        }
      }

      // sequentially upload each file in-order to avoid root corruption
      // that may occur when uploading multiple files in parallel.
      // eslint-disable-next-line no-restricted-syntax
      for (const file of dirFiles) {
        const path = sanitizePath(file.path);
        const status: AddItemsStatus = {
          path,
          status: 'success',
        };
        this.logger.info({ path }, 'Uploading file');

        try {
          const metadata = await metadataStore.upsertFileMetadata({
            uuid: v4(),
            mimeType: file.mimeType,
            bucketKey: bucket.root?.key,
            bucketSlug: bucket.slug,
            dbId: bucket.dbId,
            path,
          });
          await client.pushPath(rootKey, path, file.data, { progress: file.progress });
          // set file entry
          const existingFile = await client.listPath(rootKey, path);
          const [fileEntry] = UserStorage.parsePathItems(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            [existingFile.item!],
            {
              [path]: metadata,
            },
            bucket.slug,
            bucket.dbId,
          );

          const [fileEntryWithmembers] = await UserStorage.addMembersToPathItems([fileEntry], client, metadataStore);

          status.entry = fileEntryWithmembers;

          emitter.emit('data', status);
        } catch (err) {
          status.status = 'error';
          status.error = err;
          emitter.emit('error', status);
        }

        summary.files.push(status);
      }
    });

    return summary;
  }

  /*
   * Accepts or reject an invitation to access files from another space user.
   *
   * Typically the invitation id is gotten from a Space Mailbox for the user.
   *
   * @param invitationId - Invitation notification id
   * @param accept - set to 'true' to accept file
   */
  public async handleFileInvitation(
    invitationId: string,
    accept: boolean,
  ): Promise<AcceptInvitationResponse | undefined> {
    const inbox = await this.getNotifications(invitationId, 1);
    if (inbox.notifications.length === 0) {
      throw new Error(`invitation [${invitationId}] not found.`);
    }

    const [notification] = inbox.notifications;
    if (notification.type !== NotificationType.INVITATION) {
      throw new Error(`invitation [${invitationId}] is not valid`);
    }

    return this.upsertInvitation(notification.id, notification.relatedObject as Invitation, accept);
  }

  private async upsertInvitation(
    invitationId: string,
    invitation: Invitation,
    accept: boolean,
  ): Promise<AcceptInvitationResponse | undefined> {
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error(`invitation [${invitation.invitationID}] is no more pending`);
    }

    const client = this.getUserBucketsClient();
    const metadataStore = await this.getMetadataStore();

    const filesPaths = await Promise.all(invitation.itemPaths.map(async (fullPath) => {
      const fileMetadata = await metadataStore.upsertSharedWithMeFile({
        bucketKey: fullPath.bucketKey,
        bucketSlug: fullPath.bucket,
        path: fullPath.path,
        dbId: fullPath.dbId || '',
        mimeType: '', // TODO: Update invitation to include mimeType from sender
        sharedBy: invitation.inviterPublicKey,
        uuid: fullPath.uuid,
        accepted: accept,
        invitationId,
      });

      return this.buildSharedFileFromMetadata(client, fileMetadata);
    }));

    return {
      files: filesPaths,
    };
  }

  /**
   * Return the list of files the current storage user has shared with other users in the past
   *
   * @param offset - optional offset value for pagination. Can be gotten from the nextOffset field of a response
   *
   */
  public async getFilesSharedByMe(offset?: string): Promise<GetFilesSharedByMeResponse> {
    const client = this.getUserBucketsClient();
    const metadataStore = await this.getMetadataStore();

    const sharedFilesMetadata = await metadataStore.listSharedByMeFiles();

    const filePaths = await Promise.all(
      sharedFilesMetadata.map(async (metadata) => this.buildSharedFileFromMetadata(client, metadata)),
    );

    return {
      files: filePaths,
      nextOffset: undefined,
    };
  }

  /**
   * Returns a list of public keys of clients to which files where shared with
   *
   * @param offset - optional offset value for pagination. Can be gotten from the nextOffset field of a response
   */
  public async getRecentlySharedWith(offset?: string): Promise<GetRecentlySharedWithResponse> {
    const metadataStore = await this.getMetadataStore();
    const recentUsersData = await metadataStore.listUsersRecentlySharedWith();

    return {
      members: recentUsersData.map((user) => ({
        publicKey: user.publicKey,
        address: GetAddressFromPublicKey(user.publicKey),
        role: user.role,
      })),
      nextOffset: undefined,
    };
  }

  private static async parseMsg(msg: DecryptedUserMessage):Promise<Notification> {
    const body = JSON.parse(new TextDecoder().decode(Buffer.from(msg.decryptedBody)));

    const notif:Notification = {
      ...msg,
      decryptedBody: msg.decryptedBody,
      type: body.type as NotificationType,
    };

    switch (body.type) {
      case NotificationType.INVITATION:
        notif.relatedObject = body.body as Invitation;
    }

    return notif;
  }

  /**
   * Returns notifications for the user. If the notification is detected to be a supported
   * type, it is enhanced with additional information stored in the relatedObject field.
   *
   * @param seek - optional offset value for pagination. Can be gotten from the nextOffset field of a response
   * @param limit - optional limit value to return a specificed amount of results
   *
   */
  public async getNotifications(seek?: string, limit?:number): Promise<GetNotificationsResponse> {
    const metadataStore = await this.getMetadataStore();

    if (!this.mailbox) {
      await this.initMailbox();
    }

    const msgs: DecryptedUserMessage[] | undefined = await this.mailbox?.listInboxMessages(seek, limit);
    const notifs :Notification[] = [];
    const lastSeenAt = await metadataStore.getNotificationsLastSeenAt();
    let lastId = '';

    if (!msgs) {
      return {
        notifications: notifs,
        nextOffset: '',
        lastSeenAt,
      };
    }

    const existingStatusbyId = await this.getExistingSharedFilesStatuses(msgs.map((msg) => msg.id));

    // eslint-disable-next-line no-restricted-syntax
    for (const msg of msgs) {
      const notif = await UserStorage.parseMsg(msg);
      notifs.push(notif);
      lastId = msg.id;
    }

    const augmentedNotifs = notifs.map((notif) => {
      const augMotif = notif;
      switch (augMotif.type) {
        case NotificationType.INVITATION:
          (augMotif.relatedObject as Invitation).status = existingStatusbyId.get(notif.id) || InvitationStatus.PENDING;
      }
      return augMotif;
    });

    return {
      notifications: augmentedNotifs,
      nextOffset: lastId,
      lastSeenAt,
    };
  }

  private async getExistingSharedFilesStatuses(notificationIds: string[]) {
    const metadataStore = await this.getMetadataStore();
    const existingStatusbyId = new Map<string, InvitationStatus>();
    const existingSharedFiles = await Promise.all(notificationIds.map(async (notifId) => {
      const existingSharedFile = await metadataStore.findSharedFilesByInvitation(notifId);
      if (existingSharedFile?.accepted === true) {
        existingStatusbyId.set(notifId, InvitationStatus.ACCEPTED);
      } else if (existingSharedFile?.accepted === false) {
        existingStatusbyId.set(notifId, InvitationStatus.REJECTED);
      } else {
        existingStatusbyId.set(notifId, InvitationStatus.PENDING);
      }
    }));
    return existingStatusbyId;
  }

  /**
   * Return the list of shared files accepted by user
   *
   * @param offset - optional offset value for pagination. Can be gotten from the nextOffset field of a response
   *
   */
  public async getFilesSharedWithMe(offset?: string): Promise<GetFilesSharedWithMeResponse> {
    const metadataStore = await this.getMetadataStore();
    const client = this.getUserBucketsClient();
    const sharedFileMetadata = await metadataStore.listSharedWithMeFiles();

    const filesPaths = await Promise.all(sharedFileMetadata.map(
      async (fileMetadata) => this.buildSharedFileFromMetadata(client, fileMetadata),
    ));

    return {
      files: filesPaths,
      nextOffset: undefined, // TODO: Implement pagination
    };
  }

  // eslint-disable-next-line class-methods-use-this
  private async buildSharedFileFromMetadata(
    client: Buckets,
    fileMetadata: SharedFileMetadata,
  ): Promise<SharedWithMeFiles> {
    client.withThread(fileMetadata.dbId);
    const bucketKey = fileMetadata.bucketKey || '';

    const existingFile = await client.listPath(bucketKey, fileMetadata.path);
    if (!existingFile.item) {
      throw new DirEntryNotFoundError(fileMetadata.path, bucketKey);
    }

    const [fileEntry] = UserStorage.parsePathItems(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      [existingFile.item!],
      { [fileMetadata.path]: fileMetadata },
      fileMetadata.bucketSlug,
      fileMetadata.dbId,
    );

    return {
      entry: fileEntry,
      sharedBy: fileMetadata.sharedBy,
    };
  }

  // Note: this might be slow for large list of items or deeply nested paths.
  // This is currently a limitation of the metadatastore.
  // TODO: Make this lookup faster
  private async getFileMetadataMap(
    bucketSlug: string,
    dbId: string,
    items: PathItem[],
  ): Promise<Record<string, FileMetadata>> {
    const metadataStore = await this.getMetadataStore();
    const result: Record<string, FileMetadata> = {};

    const extractPathRecursive = (item: PathItem): string[] => ([
      filePathFromIpfsPath(item.path),
      ...flattenDeep(item.items.map(extractPathRecursive)),
    ]);
    const paths = flattenDeep(items.map(extractPathRecursive));

    this.logger.info('Building FileMetadata Map');
    await Promise.all(paths.map(async (path: string) => {
      const metadata = await metadataStore.findFileMetadata(bucketSlug, dbId, path);
      if (metadata) {
        result[path] = metadata;
      }
    }));
    this.logger.info({ paths, map: result }, 'FileMetadata Map complete');

    return result;
  }

  private async getOrCreateBucket(client: Buckets, name: string): Promise<BucketMetadataWithThreads> {
    const metadataStore = await this.getMetadataStore();
    let metadata = await metadataStore.findBucket(name);
    let dbId;
    if (!metadata) {
      dbId = ThreadID.fromRandom(ThreadID.Variant.Raw, 32).toString();
    } else {
      dbId = metadata.dbId;
    }

    const getOrCreateResponse = await client.getOrCreate(name, { threadID: dbId });

    if (!getOrCreateResponse.root) {
      throw new Error('Did not receive bucket root');
    }

    if (!metadata) {
      metadata = await metadataStore.createBucket(name, dbId, getOrCreateResponse.root.key);
    }

    // note: if initListener is not call, this won't
    // be registered
    this.listener?.addListener(metadata.dbId);

    return { ...metadata, ...getOrCreateResponse };
  }

  /**
   * setNotificationsLastSeenAt sets the field so that .
   *
   * @example
   * ```typescript
   * const result = await spaceStorage.setNotificationsLastSeenAt(Date.now());
   * ```
   */
  public async setNotificationsLastSeenAt(timestamp:number):Promise<void> {
    const metadataStore = await this.getMetadataStore();
    await metadataStore.setNotificationsLastSeenAt(timestamp);
  }

  /**
   * shareViaPublicKey shares specified files to users who owns the specified public keys.
   *
   * @example
   * ```typescript
   * const result = await spaceStorage.shareViaPublicKey({
   *   publicKeys: [{
   *      id: 'user@email.com', // or any identifier for the user
   *      pk: 'user-pk-hex-or-multibase', // optional, omit if user doesn't exist yet, it would generate temp access key
   *   }],
   *   paths: [{
   *      bucket: 'personal',
   *      path: '/file/path/here'
   *   }],
   * });
   *
   * ```
   */
  public async shareViaPublicKey(request: ShareViaPublicKeyRequest): Promise<ShareViaPublicKeyResponse> {
    validateNonEmptyArray('publicKeys', request.publicKeys);
    validateNonEmptyArray('paths', request.paths);
    const client = this.getUserBucketsClient();
    const userKeys = await this.normalizeShareKeys(request.publicKeys);
    const paths = await this.normalizeFullPaths(client, request.paths);

    // eslint-disable-next-line no-restricted-syntax
    for (const userKey of userKeys) {
      // eslint-disable-next-line no-restricted-syntax
      for (const path of paths) {
        const roles = new Map();
        const role = PathAccessRole.PATH_ACCESS_ROLE_ADMIN;
        roles.set(userKey.pk, role);
        client.withThread(path.fullPath.dbId);
        await client.pushPathAccessRoles(path.key, path.fullPath.path, roles);
      }
    }

    const idString = Buffer.from(this.user.identity.public.pubKey).toString('hex');
    const filteredRecipients: string[] = userKeys
      .map((key) => key.pk)
      .filter((key) => !!key) as string[];
    const store = await this.getMetadataStore();

    this.logger.info('Creating share files invitations');
    const invitations = await createFileInvitations(
      idString,
      paths.map((path) => path.fullPath),
      filteredRecipients,
      store,
    );

    if (!this.mailbox) {
      await this.initMailbox();
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const inv of invitations) {
      const msg = {
        type: NotificationType.INVITATION,
        body: inv,
      };
      const body = new TextEncoder().encode(JSON.stringify(msg));
      await this.mailbox?.sendMessage(inv.inviteePublicKey, body);
    }

    this.addPathToRecentlyShared(paths, store)
      .catch((err) => this.logger?.error({ err }, 'Unable to successfully track recently shared paths'));

    UserStorage.addUsersToRecentlyShared(
      userKeys.filter((key) => key.type === ShareKeyType.Existing).map((key) => key.pk),
      store,
    ).catch((err) => this.logger?.error({ err }, 'Unable to successfully track recently shared users'));

    return {
      publicKeys: userKeys.map((keys) => ({
        id: keys.id,
        pk: keys.pk,
        type: keys.type,
        tempKey: keys.tempKey,
      })),
    };
  }

  private async addPathToRecentlyShared(
    paths: { key: string; fullPath: FullPath }[],
    store: UserMetadataStore,
  ): Promise<void> {
    // eslint-disable-next-line no-restricted-syntax
    for (const { fullPath, key } of paths) {
      const fileMetadata = await store.findFileMetadata(fullPath.bucket, fullPath.dbId || '', fullPath.path);
      await store.upsertSharedByMeFile({
        bucketKey: key,
        bucketSlug: fullPath.bucket,
        dbId: fullPath.dbId || '',
        path: fullPath.path,
        sharedBy: this.user.identity.public.toString(),
        uuid: fileMetadata?.uuid,
      });
    }
  }

  private static async addUsersToRecentlyShared(users: string[], store: UserMetadataStore): Promise<void> {
    // eslint-disable-next-line no-restricted-syntax
    for (const user of users) {
      await store.addUserRecentlySharedWith({
        publicKey: user,
        role: PathAccessRole.PATH_ACCESS_ROLE_WRITER,
      });
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private normalizeShareKeys(publicKeys: SharePublicKeyInput[]): Promise<SharePublicKeyOutput[]> {
    return Promise.all(publicKeys.map(async ({ id, pk }) => {
      let type: ShareKeyType;
      let validPk: string;
      let tempKey: string | undefined;

      if (pk) {
        type = ShareKeyType.Existing;
        validPk = tryParsePublicKey(pk).toString();
      } else {
        type = ShareKeyType.Temp;
        const key = PrivateKey.fromRandom();
        tempKey = key.toString();
        validPk = key.public.toString();

        // ensures temp user is register to allow receipt of inbox
        await this.authenticateTempUser(tempKey);
      }

      return {
        id,
        pk: validPk,
        type,
        tempKey,
      };
    }));
  }

  private async normalizeFullPaths(
    client: Buckets,
    fullPaths: FullPath[],
  ): Promise<{ key: string; fullPath: FullPath; }[]> {
    this.logger.info({ fullPaths }, 'Normalizing full path');
    const bucketCache = new Map<string, BucketMetadataWithThreads>();
    const store = await this.getMetadataStore();
    return Promise.all(fullPaths.map(async (fullPath) => {
      let rootKey: string;
      let { dbId } = fullPath;
      if (dbId) {
        const metadata = await store.findFileMetadata(fullPath.bucket, dbId, fullPath.path);
        if (!metadata) {
          throw new Error('Full Paths Bucket root not found');
        }

        rootKey = metadata.bucketKey || '';
      } else {
        const bucket = await this.getOrCreateBucket(client, fullPath.bucket);
        if (!bucket.root) {
          throw new Error('Bucket root not found');
        }

        rootKey = bucket.root.key;
        dbId = bucket.dbId;
      }

      return {
        key: rootKey || '',
        fullPath: {
          ...fullPath,
          dbId,
          path: sanitizePath(fullPath.path),
        },
      };
    }));
  }

  private getUserBucketsClient(): Buckets {
    return this.initBucket(this.getUserAuth());
  }

  private getUserThreadsClient(): Client {
    return this.initThreads(this.getUserAuth());
  }

  private getUserAuth(): UserAuth {
    if (this.user.storageAuth === undefined) {
      throw new UnauthenticatedError();
    }

    return this.user.storageAuth;
  }

  private initBucket(userAuth: UserAuth): Buckets {
    if (this.config?.bucketsInit) {
      return this.config.bucketsInit(userAuth);
    }

    return Buckets.withUserAuth(userAuth, { host: this.config?.textileHubAddress });
  }

  private initThreads(userAuth: UserAuth): Client {
    if (this.config?.threadsInit) {
      return this.config.threadsInit(userAuth);
    }

    return Client.withUserAuth(userAuth, this.config?.textileHubAddress);
  }

  private async getMetadataStore(): Promise<UserMetadataStore> {
    if (this.userMetadataStore) {
      return this.userMetadataStore;
    }
    if (this.config.metadataStoreInit) {
      this.userMetadataStore = await this.config.metadataStoreInit(this.user.identity);
    } else {
      this.userMetadataStore = await this.getDefaultUserMetadataStore();
    }

    return this.userMetadataStore;
  }

  // eslint-disable-next-line class-methods-use-this
  private getDefaultUserMetadataStore(): Promise<UserMetadataStore> {
    const username = Buffer.from(this.user.identity.public.pubKey).toString('hex');
    const password = getDeterministicThreadID(this.user.identity).toString();
    return GundbMetadataStore.fromIdentity(username, password, undefined, this.logger);
  }
}
