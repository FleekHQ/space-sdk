import { expect } from 'chai';
import { decryptVaultItemData, encryptVaultItemData } from './vault';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { randomBytes } = require('crypto-browserify');

describe('encryption and decryption', () => {
  it('should work both ways', async () => {
    const actualData = 'some random data to be encrypted';
    const key = randomBytes(32);
    const encryptedData = encryptVaultItemData(actualData, key);
    const decryptedData = decryptVaultItemData(encryptedData, key);

    expect(decryptedData).to.equal(actualData);
  });
});
