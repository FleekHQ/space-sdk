import { Identity } from '@textile/crypto';
import { Buckets, PathItem, Root } from '@textile/hub';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import { anyString, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { DirEntryNotFoundError, UnauthenticatedError } from './errors';
import { UserStorage } from './userStorage';
import { makeAsyncIterableString } from './utils/streamUtils';

use(chaiAsPromised.default);
use(chaiSubset.default);

const mockIdentity: Identity = mock();

const initStubbedStorage = (): { storage: UserStorage; mockBuckets: Buckets } => {
  const mockBuckets: Buckets = mock();
  when(mockBuckets.getOrCreate(anyString())).thenReturn(
    Promise.resolve({
      root: {
        ...mock<Root>(),
        key: 'myBucketKey',
      },
    }),
  );

  const storage = new UserStorage(
    {
      identity: instance(mockIdentity),
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
      const storage = new UserStorage({ identity: instance(mockIdentity), token: '' });
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
      const storage = new UserStorage({ identity: instance(mockIdentity), token: '' });
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
      const storage = new UserStorage({ identity: instance(mockIdentity), token: '' });
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
});
