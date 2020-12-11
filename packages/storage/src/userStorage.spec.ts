import { Identity } from '@textile/crypto';
import { Buckets, Root } from '@textile/hub';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { UserStorage, UserStorageErrors } from './userStorage';

use(chaiAsPromised.default);

const mockIdentity: Identity = mock();

describe('UserStorage', () => {
  describe('createFolder()', () => {
    it('should throw error if user is not authenticated', async () => {
      const storage = new UserStorage({ identity: instance(mockIdentity), token: '' });
      await expect(storage.createFolder({ bucket: '', path: '' })).to.eventually.be.rejectedWith(
        UserStorageErrors.Unauthenticated,
      );
    });

    it('should push empty .keep file to bucket at specified path', async () => {
      const createFolderRequest = { bucket: 'personal', path: 'topLevel' };

      const mockBuckets: Buckets = mock();
      when(mockBuckets.getOrCreate(createFolderRequest.bucket)).thenReturn(
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
});
