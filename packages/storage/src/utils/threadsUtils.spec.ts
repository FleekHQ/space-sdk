import { PrivateKey } from '@textile/crypto';
import { expect } from 'chai';
import { getDeterministicThreadID } from './threadsUtils';

describe('threadsUtils', () => {
  describe('getDeterministicThreadID', () => {
    it('Follows the same protocol than space-daemon', async () => {
      // eslint-disable-next-line max-len
      const testKey = '9c25c75e1f435229707d067461eb91c0d4b4fd463db6188cd7064ccbb7276e880c29a6ffde08ebe439778481c67a145432b7d5c9f9b4e3b7b69816f45be3bbfa';
      const expectedThreadID = '015509c9db4c5070d08ed23f6281535369ca0f4b6127c58a704fb025c6d19a2a7809';

      const key = Buffer.from(testKey, 'hex').slice(0, 32);
      const identity = PrivateKey.fromRawEd25519Seed(key);

      const res = getDeterministicThreadID(identity);
      expect((res.toBytes() as Buffer).toString('hex')).to.equal(expectedThreadID);
    });
  });
});
