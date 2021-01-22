import { PublicKey } from '@textile/hub';

const isPkHex = (input: string): boolean => {
  const re = /[0-9A-Fa-f]{64}/g;
  return re.test(input);
};

/**
 * Tries to generate a ed25519 public key from the string input
 *
 * It supports multibase and hex as input
 */
export const tryParsePublicKey = (pk: string): PublicKey => {
  const keyLength = 32;
  if (isPkHex(pk)) {
    return new PublicKey(Buffer.from(pk, 'hex').slice(0, keyLength));
  }

  const key = PublicKey.fromString(pk);
  if (key.pubKey.byteLength !== keyLength) {
    throw new Error(`invalid public key: ${pk}`);
  }

  return key;
};
