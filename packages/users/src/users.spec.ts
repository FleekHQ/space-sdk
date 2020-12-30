import { PrivateKey } from '@textile/crypto';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { instance, mock, when } from 'ts-mockito';
import { Users, UsersConfig } from './users';
import { VaultBackupType } from './vault';

use(chaiAsPromised.default);

describe('Users...', () => {
  const config: UsersConfig = {
    endpoint: '',
    authChallengeSolver: async () => ({
      token: 'app-token',
      storageAuth: {
        key: '',
        token: 'mock-auth-token',
        sig: '',
        msg: '',
      },
    }),
  };

  describe('identity', () => {
    const users = new Users(config);

    it('create and authenticate', async () => {
      const identity = await users.createIdentity();
      const user = await users.authenticate(identity);

      expect(user.token).to.equal('app-token');
    });
  });

  describe('recoverKeysByPassPhrase', () => {
    it('should throw if vaultInit or vaultServiceConfig are missing', async () => {
      const users = new Users(config);
      await expect(users.recoverKeysByPassphrase('', '', VaultBackupType.Twitter)).to.eventually.be.rejected;
    });

    // it('should add new identity to identity storage', async () => {});
  });

  describe('backupKeysByPassphrase', () => {
    it('should throw if vaultInit or vaultServiceConfig is missing', async () => {
      const users = new Users(config);
      const mockIdentity: PrivateKey = mock();

      await expect(
        users.backupKeysByPassphrase('', '', VaultBackupType.Twitter, instance(mockIdentity)),
      ).to.eventually.be.rejectedWith('Either vaultServiceConfig or vaultInit configuration is required.');
    });

    it('should throw if identity provided is not a private key', async () => {
      const users = new Users(config);
      const mockIdentity: PrivateKey = mock();
      when(mockIdentity.privKey).thenReturn((null as unknown) as Uint8Array);

      await expect(
        users.backupKeysByPassphrase('', '', VaultBackupType.Twitter, instance(mockIdentity)),
      ).to.eventually.be.rejectedWith('identity provided is not a valid PrivateKey Identity.');
    });
  });
});
