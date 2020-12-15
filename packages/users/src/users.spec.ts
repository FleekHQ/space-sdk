import { expect } from 'chai';
import { BrowserStorage } from './identity/browserStorage';
import { FileStorage } from './identity/fileStorage';
import { IdentityStorage, Users } from './users';

let storageDriver: IdentityStorage;

// nodejs env
if (process.env.TS_NODE_FILES) {
  // eslint-disable-next-line global-require
  global.WebSocket = require('ws');
  storageDriver = new FileStorage(`/tmp/${Date.now()}.users.spec.ts`);
} else {
  storageDriver = new BrowserStorage();
}

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

  describe('identity storage', () => {
    it('create & authenticate & remove', async function () {
      this.timeout(10000);
      // create new Users with browser storage
      const users = await Users.withStorage(storageDriver, config);
      const identity = await users.createIdentity();
      const storedIds = await storageDriver.list();
      // identity should be added into storage
      expect(storedIds).to.have.length(1);
      // we create fresh Users instance from storage
      // users should be loaded (authenticated) from stored identities
      const usersFromStorage = await Users.withStorage(storageDriver, config);
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
      const storedIdentities = await storageDriver.list();
      expect(usersFromStorage.list()).to.have.length(0);
      expect(storedIdentities).to.have.length(0);
    });
  });
});
