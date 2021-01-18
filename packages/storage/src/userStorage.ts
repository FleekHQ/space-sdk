import { Identity, SpaceUser, GetAddressFromPublicKey } from '@spacehq/users';
import { publicKeyBytesFromString } from '@textile/crypto';
import { Buckets, PathItem, UserAuth, PathAccessRole, Root, ThreadID } from '@textile/hub';
import ee from 'event-emitter';
import dayjs from 'dayjs';
import { v4 } from 'uuid';
import { DirEntryNotFoundError, UnauthenticatedError } from './errors';
import { GundbMetadataStore } from './metadata/gundbMetadataStore';
import { BucketMetadata, UserMetadataStore } from './metadata/metadataStore';
import { AddItemsRequest,
  AddItemsResponse,
  AddItemsResultSummary,
  AddItemsStatus,
  CreateFolderRequest,
  DirectoryEntry,
  FileMember,
  ListDirectoryRequest,
  ListDirectoryResponse,
  OpenFileRequest,
  OpenFileResponse } from './types';
import { getParentPath, isTopLevelPath, reOrderPathByParents, sanitizePath } from './utils/pathUtils';
import { consumeStream } from './utils/streamUtils';
import { isMetaFileName } from './utils/fsUtils';
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
  metadataStoreInit?: (identity: Identity) => Promise<UserMetadataStore>;
}

// TODO: Change this to prod value
const DefaultTextileHubAddress = 'https://hub-dev-web.space.storage:3007';

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

  constructor(private readonly user: SpaceUser, private readonly config: UserStorageConfig = {}) {
    this.config.textileHubAddress = this.config.textileHubAddress ?? DefaultTextileHubAddress;
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

  private static parsePathItems(its: PathItem[]): DirectoryEntry[] {
    const filteredEntries = its.filter((it:PathItem) => !isMetaFileName(it.name));

    const des:DirectoryEntry[] = filteredEntries.map((it: PathItem) => {
      const paths = it.path.split(/\/ip[f|n]s\/[^\/]*/);

      if (!paths) {
        throw new Error('Unable to regex parse the path');
      }

      if (!it.metadata || !it.metadata.updatedAt) {
        throw new Error('Unable to parse updatedAt from bucket file');
      }

      const members:FileMember[] = [];
      it.metadata.roles.forEach((val:PathAccessRole, key:string) => {
        members.push({
          publicKey: key === '*' ? '*' : Buffer.from(publicKeyBytesFromString(key)).toString('hex'),
          address: key === '*' ? '' : GetAddressFromPublicKey(key),
        });
      });

      const { name, isDir, count } = it;

      // need to divide because textile gives nanoseconds
      const dt = new Date(Math.round(it.metadata.updatedAt / 1000000));
      // using moment to get required output format 2021-01-12T22:57:34-05:00
      const d = dayjs(dt);

      return ({
        name,
        isDir,
        count,
        path: paths[1],
        ipfsHash: it.cid,
        sizeInBytes: it.size,
        // using the updated date as weare in the daemon, should
        // change once createdAt is available
        created: d.format(),
        updated: d.format(),
        fileExtension: it.name.indexOf('.') >= 0 ? it.name.substr(it.name.lastIndexOf('.') + 1) : '',
        isLocallyAvailable: false,
        backupCount: 1,
        members,
        isBackupInProgress: false,
        isRestoreInProgress: false,
        items: UserStorage.parsePathItems(it.items),
      });
    });

    return des;
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

    const depth = request.recursive ? Number.MAX_SAFE_INTEGER : 0;
    try {
      const result = await client.listPath(bucket.root?.key || '', path, depth);

      if (!result.item || !result.item.items) {
        return {
          items: [],
        };
      }

      return {
        items: UserStorage.parsePathItems(result.item?.items) || [],
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
      const fileData = client.pullPath(bucket.root?.key || '', path);
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
   *     },
   *     {
   *       path: 'space.png',
   *       content: '',
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

        try {
          await this.createFolder({
            bucket: request.bucket,
            path: parentPath,
          });

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

        try {
          // eslint-disable-next-line no-await-in-loop
          await client.pushPath(bucket.root?.key || '', path, file.data);
          // eslint-disable-next-line no-await-in-loop
          await metadataStore.upsertFileMetadata({
            uuid: v4(),
            mimeType: file.mimeType,
            bucketSlug: bucket.slug,
            dbId: bucket.dbId,
            path,
          });
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

  private async getOrCreateBucket(client: Buckets, name: string): Promise<BucketMetadataWithThreads> {
    const metadataStore = await this.getMetadataStore();
    let metadata = await metadataStore.findBucket(name);
    if (!metadata) {
      const dbId = ThreadID.fromRandom(ThreadID.Variant.Raw, 32).toString();
      metadata = await metadataStore.createBucket(name, dbId);
    }

    const getOrCreateResponse = await client.getOrCreate(name, { threadID: metadata.dbId });

    return { ...metadata, ...getOrCreateResponse };
  }

  private getUserBucketsClient(): Buckets {
    return this.initBucket(this.getUserAuth());
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
    return GundbMetadataStore.fromIdentity(username, password);
  }
}
