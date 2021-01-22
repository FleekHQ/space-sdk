import { expect } from 'chai';
import { tryParsePublicKey } from './crypto';

describe('tryParsePublicKey', () => {
  it('should parse hex public keys successfully', () => {
    const actualMultibaseKey = 'bbaareicf6ksgnnafdkopyczls2gpovidniwnl5hn465xt5isswfubi5g6y';
    const hexKey = '45f2a466b4051a9cfc0b2b968cf755036a2cd5f4ede7bb79f512958b40a3a6f6';

    const pk = tryParsePublicKey(hexKey);

    expect(pk.toString()).to.equal(actualMultibaseKey);
  });

  it('should parse multibase encoded keys successfully', () => {
    const base32Key = 'bbaareicf6ksgnnafdkopyczls2gpovidniwnl5hn465xt5isswfubi5g6y';
    tryParsePublicKey(base32Key);
  });
});
