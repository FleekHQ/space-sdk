import { BrowserStorage, Users, VaultBackupType } from '@spacehq/sdk';
import { expect } from 'chai';
import { TestsDefaultTimeout, TestUsersConfig } from './fixtures/configs';
import { authenticateAnonymousUser } from './helpers/userHelper';

describe('Users interactions', () => {
  it('user should be able to authenticate', async () => {
    const { user } = await authenticateAnonymousUser();
    expect(user).to.have.property('token');
    expect(user).to.have.property('storageAuth');
  }).timeout(TestsDefaultTimeout);

  describe('when using browser', () => {
    // new identity storage
    const browserStorage = new BrowserStorage();

    it('create & authenticate & remove', async () => {
      // create new Users with browser storage
      const users = await Users.withStorage(browserStorage, TestUsersConfig);
      const identity = await users.createIdentity();
      const storedIds = await browserStorage.list();
      // identity should be added into storage
      expect(storedIds).to.have.length(1);
      // we create fresh Users instance from storage
      // users should be loaded (authenticated) from stored identities
      const usersFromStorage = await Users.withStorage(browserStorage, TestUsersConfig);
      const spaceUsers = usersFromStorage.list();
      // we expect 1 user is signed in
      expect(spaceUsers).to.have.length(1);
      const spaceUser = spaceUsers.shift();
      expect(spaceUser).to.have.property('token');
      expect(spaceUser).to.have.property('identity');
      expect(spaceUser).to.have.property('storageAuth');

      // identity must be matching
      expect(spaceUser?.identity.public.toString()).to.equal(identity.public.toString());

      // remove user identity
      await usersFromStorage.remove(identity.public.toString());
      const storedIdentities = await browserStorage.list();
      expect(usersFromStorage.list()).to.have.length(0);
      expect(storedIdentities).to.have.length(0);
    }).timeout(TestsDefaultTimeout);
  });

  describe('backup and recovery', () => {
    it('user should be able to backup and recover via passphrase', async () => {
      // create new anonymous user
      const users = new Users(TestUsersConfig);
      // backup users identity via passphrase
      // try recovering users identity from a new users instance
      const user = await users.recoverKeysByPassphrase(
        '96f7a52f-b555-4d2e-93ec-f627539fd3ae',
        '0xe8b1b9d782083f5217b017a113161f09eb0b6d4239d93b6cc639910ccbb06852',
        VaultBackupType.Twitter,
      );
      // verify that user is in storage
    });
  });
});
