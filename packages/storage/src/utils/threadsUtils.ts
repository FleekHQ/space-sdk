import { Identity } from '@spacehq/users';
import { PrivateKey, PublicKey } from '@textile/crypto';
import { ThreadID } from '@textile/threads-id';
import { encode } from 'varint';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pbkdf2Sync } = require('crypto-browserify');

export enum DeterministicThreadVariant {
  MetathreadThreadVariant = 'metathread',
}

export enum ThreadKeyVariant {
  metathreadVariant = 'metathreadV1',
}

/**
 * Builds a thread ID that's going to be the same every time for a given user key pair.
 * Used for example to store user-related metadata
 * @param identity The crypto identity that holds the private key
 * @param variant The deterministic thread variant
 */
export const getDeterministicThreadID = (
  identity: Identity,
  variant: DeterministicThreadVariant = DeterministicThreadVariant.MetathreadThreadVariant,
): ThreadID => {
  // We need the raw key, thus we use marshal() instead of bytes
  const pk = identity.privKey;
  const keyLen = 32;
  const v = ThreadID.Variant.Raw;
  const encoder = new TextEncoder();
  const salt = encoder.encode(`threadID${variant}`);

  // Based on https://github.com/FleekHQ/space-daemon/blob/master/core/textile/utils/utils.go#L77
  const derivedPk: Buffer = pbkdf2Sync(pk, salt, 256, keyLen, 'sha512');

  // and https://github.com/textileio/js-threads/blob/master/packages/id/src/index.ts#L59
  const bytes = Buffer.concat([Buffer.from(encode(ThreadID.V1)), Buffer.from(encode(v)), derivedPk]);

  return new ThreadID(bytes);
};

export const getManagedThreadKey = (identity: PrivateKey, threadKeyVariant: ThreadKeyVariant): Uint8Array => {
  const pk = identity.privKey;
  const keyLen = 32;
  const keyBytes = 32;
  const v = ThreadID.Variant.Raw;
  const encoder = new TextEncoder();
  const salt = encoder.encode(`threadKey${threadKeyVariant}`);

  // Based on https://github.com/FleekHQ/space-daemon/blob/master/core/keychain.go
  const derivedPk: Buffer = pbkdf2Sync(pk, salt, 256, keyLen, 'sha512');

  return derivedPk.slice(0, keyBytes * 2);
};

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
