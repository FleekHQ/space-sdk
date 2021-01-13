import { expect } from 'chai';
import { GetAddressFromPublicKey } from './address';

describe('utils', () => {
  describe('GetAddressFromPublicKey', () => {
    it('should return the correct address', () => {
      // expected value was generated from daemon and tested for compatibility
      const pubkey = 'bbaareieswor4fnmzdwmv6fwij2rxyyjmpc2izognkiqnfxlvnzzsvs7y5y';
      const expectedAddress = '0x61de836bba6eb63ffca5aab44c46d8aca1c4';
      const actualAddress = GetAddressFromPublicKey(pubkey);
      expect(actualAddress).to.equal(expectedAddress);
    });
  });
});
