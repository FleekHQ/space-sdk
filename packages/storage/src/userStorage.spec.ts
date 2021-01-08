import { Identity } from '@spacehq/users';
import { PrivateKey } from '@textile/crypto';
import { Buckets, PathItem, PushPathResult, Root } from '@textile/hub';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import { anyString, anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { DirEntryNotFoundError, UnauthenticatedError } from './errors';
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
      const actualItem = {
        name: 'folder',
        path: '/folder',
        cid: '',
        isDir: true,
        size: 10,
      };
      const { storage, mockBuckets } = initStubbedStorage();
      when(mockBuckets.listPath('myBucketKey', `/${listDirectoryRequest.path}`, 1)).thenResolve({
        item: {
          ...mock<PathItem>(),
          items: [
            {
              ...actualItem,
              items: [],
              count: 1,
            },
          ],
        },
      });

      const result = await storage.listDirectory(listDirectoryRequest);

      expect(result).to.not.equal(undefined);
      expect(result.items).to.containSubset([actualItem]);
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
