import { Identity, GetAddressFromPublicKey } from '@spacehq/users';
import { PrivateKey } from '@textile/crypto';
import { Buckets, PathAccessRole, PathItem, PushPathResult, Root } from '@textile/hub';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import dayjs from 'dayjs';
import { noop } from 'lodash';
import { anyString, anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { v4 } from 'uuid';
import { DirEntryNotFoundError, UnauthenticatedError } from './errors';
import { BucketMetadata,
  FileMetadata,
  SharedFileMetadata,
  UserMetadataStore,
  ShareUserMetadata } from './metadata/metadataStore';
import { makeAsyncIterableString } from './testHelpers';
import { AddItemsEventData } from './types';
import { UserStorage } from './userStorage';

use(chaiAsPromised.default);
use(chaiSubset.default);

const mockIdentity: Identity = PrivateKey.fromRandom();

const initStubbedStorage = (): { storage: UserStorage; mockBuckets: Buckets } => {
  const mockBuckets: Buckets = mock();
  when(mockBuckets.getOrCreate(anyString(), anything())).thenReturn(
    Promise.resolve({
      root: {
        ...mock<Root>(),
        key: 'myBucketKey',
      },
    }),
  );

  // const mockMetadataStore: UserMetadataStore = mock();
  // when(mockMetadataStore.findBucket(anyString())).thenReturn(Promise.resolve(undefined));
  // when(mockMetadataStore.createBucket(anyString(), anyString())).thenReturn(Promise.resolve({
  //   slug: 'myBucketKey',
  //   encryptionKey: new Uint8Array(80),
  //   dbId: 'dbId',
  // }));

  const storage = new UserStorage(
    {
      identity: mockIdentity,
      token: '',
      endpoint: 'http://space-auth-endpoint.com',
      storageAuth: {
        key: 'random-key',
        token: 'token',
        sig: 'sig',
        msg: 'msg',
      },
    },
    {
      bucketsInit: () => instance(mockBuckets),
      metadataStoreInit: async (): Promise<UserMetadataStore> =>
        // commenting this out now because it causes test to silently fail
        // return instance(mockMetadataStore); // to be fixed later
        // eslint-disable-next-line implicit-arrow-linebreak
        Promise.resolve({
          createBucket(bucketSlug: string, dbId: string): Promise<BucketMetadata> {
            return Promise.resolve({
              bucketKey: 'testkey',
              slug: 'myBucketKey',
              encryptionKey: new Uint8Array(80),
              dbId: 'dbId',
            });
          },
          findBucket(bucketSlug: string): Promise<BucketMetadata | undefined> {
            return Promise.resolve({
              bucketKey: 'testkey',
              slug: 'myBucketKey',
              encryptionKey: new Uint8Array(80),
              dbId: 'dbId',
            });
          },
          listBuckets(): Promise<BucketMetadata[]> {
            return Promise.resolve([]);
          },
          upsertFileMetadata(input: FileMetadata): Promise<FileMetadata> {
            return Promise.resolve({ ...input, bucketSlug: 'myBucket', dbId: '', path: '/' });
          },
          findFileMetadata(bucketSlug, dbId, path): Promise<FileMetadata | undefined> {
            return Promise.resolve({ uuid: 'generated-uuid', mimeType: 'generic/type', bucketSlug, dbId, path });
          },
          findFileMetadataByUuid(): Promise<FileMetadata | undefined> {
            return Promise.resolve({
              mimeType: 'generic/type',
              bucketSlug: 'myBucket',
              bucketKey: 'myBucketKey',
              dbId: 'mockThreadId',
              path: '/',
            });
          },
          setFilePublic(_metadata: FileMetadata): Promise<void> {
            return Promise.resolve();
          },
          async upsertSharedWithMeFile(data: SharedFileMetadata): Promise<SharedFileMetadata> {
            return data;
          },
          async listSharedWithMeFiles(): Promise<SharedFileMetadata[]> {
            return [];
          },
          async upsertSharedByMeFile(data: SharedFileMetadata): Promise<SharedFileMetadata> {
            return data;
          },
          async findSharedFilesByInvitation(id: string): Promise<SharedFileMetadata | undefined> {
            return undefined;
          },
          async listSharedByMeFiles(): Promise<SharedFileMetadata[]> {
            return [];
          },
          async addUserRecentlySharedWith(data: ShareUserMetadata): Promise<ShareUserMetadata> {
            return data;
          },
          async listUsersRecentlySharedWith(): Promise<ShareUserMetadata[]> {
            return [];
          },
          async getNotificationsLastSeenAt():Promise<number> {
            return Date.now();
          },
          async setNotificationsLastSeenAt(timestamp:number):Promise<void> {
            noop;
          },
        }),
    },
  );

  return { storage, mockBuckets };
};

describe('UserStorage', () => {
  describe('createFolder()', () => {
    it('should throw error if user is not authenticated', async () => {
      const storage = new UserStorage({ identity: mockIdentity, token: '', endpoint: '' });
      await expect(storage.createFolder({ bucket: '', path: '' })).to.eventually.be.rejectedWith(UnauthenticatedError);
    });

    it('should push empty .keep file to bucket at specified path', async () => {
      const createFolderRequest = { bucket: 'personal', path: 'topLevel' };
      const { storage, mockBuckets } = initStubbedStorage();

      await storage.createFolder(createFolderRequest);

      verify(
        mockBuckets.pushPath(
          'myBucketKey',
          '.keep',
          deepEqual({
            path: '/topLevel/.keep',
            content: Buffer.from(''),
          }),
        ),
      ).called();
    });
  });

  describe('listDirectory()', () => {
    it('should throw error if user is not authenticated', async () => {
      const storage = new UserStorage({ identity: mockIdentity, token: '', endpoint: '' });
      await expect(storage.listDirectory({ bucket: 'bucket', path: '' })).to.eventually.be.rejectedWith(
        UnauthenticatedError,
      );
    });

    it('should return list of items', async () => {
      const listDirectoryRequest = { bucket: 'personal', path: 'topLevel' };

      const mainItem = mock<PathItem>();

      const childItem = {
        name: 'folder',
        path: '/ipfs/Qm123/folder',
        cid: 'Qm...',
        isDir: true,
        size: 10,
      };

      const updatedAt = (new Date().getMilliseconds()) * 1000000;

      const { storage, mockBuckets } = initStubbedStorage();
      when(mockBuckets.listPath('myBucketKey', `/${listDirectoryRequest.path}`, 0)).thenResolve({
        item: {
          ...mainItem,
          items: [
            {
              ...childItem,
              metadata: {
                updatedAt,
                roles: new Map(),
              },
              items: [],
              count: 1,
            },
          ],
        },
      });

      const mockMembers = new Map<string, PathAccessRole>();
      const pubkey = 'bbaareieswor4fnmzdwmv6fwij2rxyyjmpc2izognkiqnfxlvnzzsvs7y5y';
      mockMembers.set(pubkey, PathAccessRole.PATH_ACCESS_ROLE_WRITER);
      when(mockBuckets.pullPathAccessRoles(anyString(), anyString())).thenResolve(mockMembers);

      const result = await storage.listDirectory(listDirectoryRequest);

      const expectedDate = dayjs(new Date(Math.round(updatedAt / 1000000))).format();

      expect(result).to.not.equal(undefined);
      expect(result.items[0]).to.not.equal(undefined);
      expect(result.items[0].name).to.equal(childItem.name);
      expect(result.items[0].bucket).to.not.be.empty;
      expect(result.items[0].dbId).to.not.be.empty;
      expect(result.items[0].ipfsHash).to.equal(childItem.cid);
      expect(result.items[0].isDir).to.equal(childItem.isDir);
      expect(result.items[0].sizeInBytes).to.equal(childItem.size);
      expect(result.items[0].created).to.equal(expectedDate);
      expect(result.items[0].updated).to.equal(expectedDate);
      expect(result.items[0].fileExtension).to.equal('');
      expect(result.items[0].isLocallyAvailable).to.equal(false);
      expect(result.items[0].backupCount).to.equal(1);
      expect(result.items[0].members).to.deep.equal([{
        publicKey: pubkey,
        role: PathAccessRole.PATH_ACCESS_ROLE_WRITER,
        address: GetAddressFromPublicKey(pubkey),
      }]);
      expect(result.items[0].isBackupInProgress).to.equal(false);
      expect(result.items[0].isRestoreInProgress).to.equal(false);
      expect(result.items[0].uuid).to.equal('generated-uuid');
    });
  });

  describe('openFile()', () => {
    // it('should throw error if user is not authenticated', async () => {
    //   const storage = new UserStorage({ identity: mockIdentity, token: '' });
    //   await expect(storage.openFile({ bucket: 'bucket', path: '' })).to.eventually.be.rejectedWith(
    //     UnauthenticatedError,
    //   );
    // });

    it('should throw if file is not found', async () => {
      const { storage, mockBuckets } = initStubbedStorage();
      when(mockBuckets.pullPath('myBucketKey', '/file.txt', anything())).thenThrow(
        new Error('Error: no link named "file.txt" under QmVQWu2C3ZgdoAmBsffFASrgynAfgvYX8CCK4o9SxRvC4p'),
      );

      await expect(storage.openFile({ bucket: 'personal', path: '/file.txt' })).to.eventually.be.rejectedWith(
        DirEntryNotFoundError,
      );
    });

    it('should return a valid stream of files data', async () => {
      const { storage, mockBuckets } = initStubbedStorage();
      const actualFileContent = "file.txt's file content";
      when(mockBuckets.pullPath('myBucketKey', '/file.txt', anything())).thenReturn(
        makeAsyncIterableString(actualFileContent) as AsyncIterableIterator<Uint8Array>,
      );

      const result = await storage.openFile({ bucket: 'personal', path: '/file.txt' });
      const filesData = await result.consumeStream();

      expect(new TextDecoder('utf8').decode(filesData)).to.equal(actualFileContent);
      expect(result.mimeType).to.equal('generic/type');
    });
  });

  describe('openFileByUuid', () => {
    // it('should throw if uuid is not found', async () => {
    //  // fix this when mocking metadatastore works
    // });

    it('should return a valid stream of files data', async () => {
      const { storage, mockBuckets } = initStubbedStorage();
      const fileUuid = v4();
      const actualFileContent = "file.txt's file content";
      when(mockBuckets.existing('mockThreadId')).thenReturn(Promise.resolve([
        {
          ...mock<Root>(),
          name: 'myBucket',
          key: 'myBucketKey',
        },
      ]));
      when(mockBuckets.listPath('myBucketKey', anyString())).thenResolve({
        item: {
          ...mock<PathItem>(),
          name: 'file.txt',
          path: '/ipfs/Qm123/file.txt',
          metadata: {
            updatedAt: (new Date().getMilliseconds()) * 1000000,
            roles: new Map(),
          },
          items: [],
        },
      });

      when(mockBuckets.pullPath('myBucketKey', anyString(), anything())).thenReturn(
        makeAsyncIterableString(actualFileContent) as AsyncIterableIterator<Uint8Array>,
      );

      const mockMembers = new Map<string, PathAccessRole>();
      mockMembers.set('dummykey', PathAccessRole.PATH_ACCESS_ROLE_WRITER);
      when(mockBuckets.pullPathAccessRoles('myBucketKey', '/ipfs/Qm123/file.txt')).thenResolve(mockMembers);

      const result = await storage.openFileByUuid({ uuid: fileUuid });
      const filesData = await result.consumeStream();

      expect(new TextDecoder('utf8').decode(filesData)).to.equal(actualFileContent);
      expect(result.mimeType).to.equal('generic/type');
      expect(result.entry.bucket).to.not.be.empty;
      expect(result.entry.dbId).to.not.be.empty;
    });
  });

  describe('addItems()', () => {
    it('should publish data, error and done events correctly', async () => {
      const { storage, mockBuckets } = initStubbedStorage();
      const uploadError = new Error('update is non-fast-forward');
      when(mockBuckets.pushPath('myBucketKey', anyString(), anything(), anything())).thenResolve({
        ...mock<PushPathResult>(),
      });

      const childItem = {
        name: 'entryName',
        path: '/ipfs/Qm123/entryName',
        cid: 'Qm...',
        isDir: false,
        size: 10,
      };

      when(mockBuckets.listPath('myBucketKey', anyString())).thenResolve({
        item: {
          ...mock<PathItem>(),
          name: 'entryName',
          path: '/ipfs/Qm123/entryName',
          cid: 'Qm...',
          isDir: false,
          size: 10,
          metadata: {
            updatedAt: (new Date().getMilliseconds()) * 1000000,
            roles: new Map<string, PathAccessRole>(),
          },
          count: 0,
          items: [],
        },
      });

      // fail upload of b.txt
      when(mockBuckets.pushPath('myBucketKey', '/b.txt', anything(), anything())).thenReject(uploadError);
      const callbackData = {
        data: [] as AddItemsEventData[],
        error: [] as AddItemsEventData[],
        done: [] as AddItemsEventData[],
      };

      // upload files
      const uploadResponse = await storage.addItems({
        bucket: 'personal',
        files: [
          {
            path: '/top/a.txt',
            data: 'a content',
            mimeType: 'text/plain',
          },
          {
            path: 'b.txt',
            data: 'b content',
            mimeType: 'text/plain',
          },
        ],
      });

      // listen for status events
      uploadResponse.on('data', (it) => callbackData.data.push(it));
      uploadResponse.on('error', (err) => callbackData.error.push(err));
      await new Promise((resolve) => {
        uploadResponse.once('done', (it) => {
          callbackData.done.push(it);
          resolve();
        });
      });

      // verify callback data
      expect(callbackData.data).to.containSubset([
        { path: '/top/a.txt', status: 'success' },
        { path: '/top', status: 'success' },
      ]);
      expect(callbackData.error).to.containSubset([{ path: '/b.txt', status: 'error', error: uploadError }]);
      expect(callbackData.done).to.containSubset([
        {
          bucket: 'personal',
          files: [
            { path: '/top', status: 'success' },
            { path: '/top/a.txt', status: 'success' },
            { path: '/b.txt', status: 'error', error: uploadError },
          ],
        },
      ]);
    });
  });

  describe('shareViaPublicKey()', () => {
    let storage: UserStorage;
    let mockBuckets: Buckets;

    beforeEach(() => {
      const stub = initStubbedStorage();
      storage = stub.storage;
      mockBuckets = stub.mockBuckets;
    });

    it('should throw if public keys are empty', async () => {
      await expect(
        storage.shareViaPublicKey({
          publicKeys: [],
          paths: [
            {
              bucket: 'personal',
              path: '/randomPath',
            },
          ],
        }),
      ).to.eventually.be.rejected;
    });

    it('should throw if public keys are not valid', async () => {
      await expect(
        storage.shareViaPublicKey({
          publicKeys: [{
            id: 'space-user@space.storage',
            pk: 'invalid-pk-provided',
          }],
          paths: [
            {
              bucket: 'personal',
              path: '/randomPath',
            },
          ],
        }),
      ).to.eventually.be.rejectedWith('Unsupported encoding: i');
    });
  });
});
