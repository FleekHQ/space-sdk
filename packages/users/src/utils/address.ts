import { publicKeyBytesFromString } from '@textile/crypto';
// Standard FIPS 202 SHA-3 implementation (not keccak)
import { SHA3 } from 'sha3';

export const GetAddressFromPublicKey = (pubkey: string): string => {
  const pubkeyb = publicKeyBytesFromString(pubkey);
  const hasher = new SHA3(256);
  const hexHash = hasher.update(Buffer.from(pubkeyb).toString('hex'), 'hex').digest('hex');
  const trimmed = hexHash.slice(28);
  return `0x${trimmed}`;
};
