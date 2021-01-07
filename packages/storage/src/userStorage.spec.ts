import { Identity } from '@spacehq/users';
import { PrivateKey } from '@textile/crypto';
import { Buckets, PathAccessRole, PathItem, PushPathResult, Root } from '@textile/hub';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import { anyString, anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { DirEntryNotFoundError, UnauthenticatedError } from './errors';
import { BucketMetadata, UserMetadataStore } from './metadata/metadataStore'
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
  // when(mockMetadataStore.findBucket(anyString(), anyString())).thenReturn(Promise.resolve(undefined));
  // when(mockMetadataStore.createBucket(anyString(), anyString())).thenReturn(Promise.resolve({
  //   slug: 'myBucketKey',
  //   encryptionKey: new Uint8Array(80),
  //   dbId: 'dbId',
  // }));

  const storage = new UserStorage(
    {
      identity: mockIdentity,
      token: '',
      storageAuth: {
        key: 'random-key',
        token: 'token',
        sig: 'sig',
        msg: 'msg',
      },
    },
    {
      bucketsInit: () => instance(mockBuckets),
      metadataStoreInit: async (): Promise<UserMetadataStore> => {
        // commenting this out now because it causes test to silently fail
        // return instance(mockMetadataStore); // to be fixed later
        return Promise.resolve({
          createBucket(bucketSlug: string, dbId: string): Promise<BucketMetadata> {
            return Promise.resolve({
              slug: 'myBucketKey',
              encryptionKey: new Uint8Array(80),
              dbId: 'dbId',
            });
          },
          findBucket(bucketSlug: string, dbId: string): Promise<BucketMetadata | undefined> {
            return Promise.resolve({
              slug: 'myBucketKey',
              encryptionKey: new Uint8Array(80),
              dbId: 'dbId',
            });
          },
          listBuckets(): Promise<BucketMetadata[]> {
            return Promise.resolve([]);
          },

        });
      },
    },
  );

  return { storage, mockBuckets };
};

describe('UserStorage', () => {
  describe('createFolder()', () => {
    it('should throw error if user is not authenticated', async () => {
      const storage = new UserStorage({ identity: mockIdentity, token: '' });
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
      const storage = new UserStorage({ identity: mockIdentity, token: '' });
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

      const roles = new Map<string, PathAccessRole>();
      const pubkey = "ab1";
      roles.set(pubkey, PathAccessRole.PATH_ACCESS_ROLE_ADMIN);

      const { storage, mockBuckets } = initStubbedStorage();
      when(mockBuckets.listPath('myBucketKey', `/${listDirectoryRequest.path}`, 1)).thenResolve({
        item: {
          ...mainItem,
          items: [
            {
              ...childItem,
              metadata: {
                updatedAt: new Date().getMilliseconds(),
                roles,
              },
              items: [],
              count: 1,
            },
          ],
        },
      });

      const result = await storage.listDirectory(listDirectoryRequest);

      expect(result).to.not.equal(undefined);
      expect(result.items[0]).to.not.equal(undefined);
      expect(result.items[0].name).to.equal(childItem.name);
      expect(result.items[0].ipfsHash).to.equal(childItem.cid);
      expect(result.items[0].isDir).to.equal(childItem.isDir);
      expect(result.items[0].sizeInBytes).to.equal(childItem.size);
      expect(result.items[0].created).to.not.equal(undefined);
      expect(result.items[0].updated).to.not.equal(undefined);
      expect(result.items[0].fileExtension).to.equal("");
      expect(result.items[0].isLocallyAvailable).to.equal(false);
      expect(result.items[0].backupCount).to.equal(1);
      expect(result.items[0].members).to.deep.equal([{
        publicKey: pubkey,
      }]);
      expect(result.items[0].isBackupInProgress).to.equal(false);
      expect(result.items[0].isRestoreInProgress).to.equal(false);
    });
  });

  describe('openFile()', () => {
    it('should throw error if user is not authenticated', async () => {
      const storage = new UserStorage({ identity: mockIdentity, token: '' });
      await expect(storage.openFile({ bucket: 'bucket', path: '' })).to.eventually.be.rejectedWith(
        UnauthenticatedError,
      );
    });

    it('should throw if file is not found', async () => {
      const { storage, mockBuckets } = initStubbedStorage();
      when(mockBuckets.pullPath('myBucketKey', '/file.txt')).thenThrow(
        new Error('Error: no link named "file.txt" under QmVQWu2C3ZgdoAmBsffFASrgynAfgvYX8CCK4o9SxRvC4p'),
      );

      await expect(storage.openFile({ bucket: 'personal', path: '/file.txt' })).to.eventually.be.rejectedWith(
        DirEntryNotFoundError,
      );
    });

    it('should return a valid stream of files data', async () => {
      const { storage, mockBuckets } = initStubbedStorage();
      const actualFileContent = "file.txt's file content";
      when(mockBuckets.pullPath('myBucketKey', '/file.txt')).thenReturn(
        makeAsyncIterableString(actualFileContent) as AsyncIterableIterator<Uint8Array>,
      );

      const result = await storage.openFile({ bucket: 'personal', path: '/file.txt' });
      const filesData = await result.consumeStream();

      expect(new TextDecoder('utf8').decode(filesData)).to.equal(actualFileContent);
    });
  });

  describe('addItems()', () => {
    it('should publish data, error and done events correctly', async () => {
      const { storage, mockBuckets } = initStubbedStorage();
      const uploadError = new Error('update is non-fast-forward');
      when(mockBuckets.pushPath('myBucketKey', anyString(), anything())).thenResolve({
        ...mock<PushPathResult>(),
      });
      // fail upload of b.txt
      when(mockBuckets.pushPath('myBucketKey', '/b.txt', anything())).thenReject(uploadError);
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
          },
          {
            path: 'b.txt',
            data: 'b content',
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
});
