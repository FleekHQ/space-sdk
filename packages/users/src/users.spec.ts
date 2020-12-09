import { expect } from 'chai'
import { Users } from './users'

// @todo: replace this by mocked service
const endpoint = 'gqo1oqz055.execute-api.us-west-2.amazonaws.com/dev';

describe('Users...', () => {
  describe('identity', () => {
    const users = new Users({
      endpoint,
    });
    const identity = users.createIdentity();

    it('authenticate', async function () {
      this.timeout(5000);
       const user = await users.authenticate(identity);
       console.log({ user });
       expect(user).to.have.property('token');
    })
  })
})
