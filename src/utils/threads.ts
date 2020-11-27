import { ThreadID } from '@textile/threads';
import { Libp2pCryptoIdentity, ThreadKey } from '@textile/threads-core';
import { encode } from 'varint';
import { threads } from '.';
import { ed25519 } from './keys';
import { DeterministicThreadVariant, ThreadKeyVariant } from './types';
const { pbkdf2Sync } = require('crypto-browserify');

/**
 * Builds a thread ID that's going to be the same every time for a given user key pair.
 * Used for example to store user-related metadata
 * @param identity The crypto identity that holds the private key
 * @param variant The deterministic thread variant
 */
export const getDeterministicThreadID = (
  identity: Libp2pCryptoIdentity,
  variant: DeterministicThreadVariant = DeterministicThreadVariant.MetathreadThreadVariant,
): ThreadID => {
  // We need the raw key, thus we use marshal() instead of bytes
  const pk = ed25519.getRawPrivKeyFromIdentity(identity);
  const keyLen = 32;
  const v = ThreadID.Variant.Raw;
  const encoder = new TextEncoder();
  const salt = encoder.encode('threadID' + variant);

  // Based on https://github.com/FleekHQ/space-daemon/blob/master/core/textile/utils/utils.go#L77
  const derivedPk: Buffer = pbkdf2Sync(pk, salt, 256, keyLen, 'sha512');

  // and https://github.com/textileio/js-threads/blob/master/packages/id/src/index.ts#L59
  const bytes = Buffer.concat([Buffer.from(encode(ThreadID.V1)), Buffer.from(encode(v)), derivedPk]);

  return new ThreadID(bytes);
};

export const getManagedThreadKey = (identity: Libp2pCryptoIdentity, threadKeyVariant: ThreadKeyVariant): ThreadKey => {
  // We need the raw key, thus we use marshal() instead of bytes
  const pk = ed25519.getRawPrivKeyFromIdentity(identity);
  const keyLen = 32;
  const keyBytes = 32;
  const v = ThreadID.Variant.Raw;
  const encoder = new TextEncoder();
  const salt = encoder.encode('threadKey' + threadKeyVariant);

  // Based on https://github.com/FleekHQ/space-daemon/blob/master/core/keychain.go
  const derivedPk: Buffer = pbkdf2Sync(pk, salt, 256, keyLen, 'sha512');

  const truncated = derivedPk.slice(0, keyBytes * 2);
  return ThreadKey.fromBytes(truncated);
};
