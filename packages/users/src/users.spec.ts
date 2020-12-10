import { expect } from 'chai';
import { BrowserStorage } from './identity/browserStorage';
import { Users } from './users';

// @todo: replace this by mocked service
const endpoint = 'gqo1oqz055.execute-api.us-west-2.amazonaws.com/dev';
const config = {
  endpoint,
};

describe('Users...', () => {
  describe('identity', () => {
    const users = new Users(config);

    it('create and authenticate', async function () {
      this.timeout(10000);
      const identity = await users.createIdentity();
      const user = await users.authenticate(identity);
      expect(user).to.have.property('token');
      expect(user).to.have.property('storageAuth');
    });
  });

  describe('browser storage', () => {
    // new identity storage
    const browserStorage = new BrowserStorage();

    it('create & authenticate & remove', async function () {
      this.timeout(10000);
      // create new Users with browser storage
      const users = await Users.withStorage(browserStorage, config);
      const identity = await users.createIdentity();
      const storedIds = await browserStorage.list();
      // identity should be added into storage
      expect(storedIds).to.have.length(1);
      // we create fresh Users instance from storage
      // users should be loaded (authenticated) from stored identities
      const usersFromStorage = await Users.withStorage(browserStorage, config);
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
    });
  });
});
