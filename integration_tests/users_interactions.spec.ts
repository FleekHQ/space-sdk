import { BrowserStorage, Users, UserStorage, VaultBackupType } from '@spacehq/sdk';
import { expect, use } from 'chai';
import * as chaiSubset from 'chai-subset';
import { TestsDefaultTimeout, TestUsersConfig } from './fixtures/configs';
import { authenticateAnonymousUser } from './helpers/userHelper';

use(chaiSubset.default);

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
    const getUuidFromSessionToken = (token: string): string => {
      const [meta, data, signature] = token.split('.'); // token is a jwt token
      return JSON.parse(Buffer.from(data, 'base64').toString()).uuid;
    };

    it('user should be able to backup and recover via passphrase', async () => {
      // create new anonymous user
      const { user, users } = await authenticateAnonymousUser();
      const uuid = getUuidFromSessionToken(user.token);
      const passphrase = '0xe8b1b9d782083f5217b017a113161f09eb0b6d4239d93b6cc639910ccbb06852';
      const backupType = VaultBackupType.Twitter;

      // Perform some data storage with user
      const storage = new UserStorage(user);
      await storage.createFolder({
        bucket: 'personal',
        path: '/newFolder',
      });

      // backup users identity via passphrase
      await users.backupKeysByPassphrase(uuid, passphrase, backupType, user.identity);

      // try recovering users identity from a new users instance
      const recoveredUser = await users.recoverKeysByPassphrase(uuid, passphrase, backupType);
      expect(recoveredUser.identity.public.toString()).to.equal(user.identity.public.toString());

      // verify recovered user still has existing storage data
      const recoveredUsersStorage = new UserStorage(recoveredUser);
      const directories = await recoveredUsersStorage.listDirectory({
        bucket: 'personal',
        path: '',
      });
      expect(directories.items).to.containSubset([
        {
          name: 'newFolder',
          isDir: true,
        },
      ]);
    }).timeout(TestsDefaultTimeout);
  });
});
