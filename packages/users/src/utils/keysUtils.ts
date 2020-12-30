import { Libp2pCryptoIdentity } from '@textile/threads-core';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const protobuf = require('protons');

const pbm = protobuf(`
enum KeyType {
  RSA = 0;
  Ed25519 = 1;
  Secp256k1 = 2;
}
message PublicKey {
  required KeyType Type = 1;
  required bytes Data = 2;
}
message PrivateKey {
  required KeyType Type = 1;
  required bytes Data = 2;
}
`);

/**
 * Converts a raw ed25519 key into one wrapped by libp2p's protobuf serialization
 * NOTE: js-libp2p-crypto surprisingly doesn't expose a function like this.
 * Apparently they are always expecting their API users to submit an already wrapped key or generate one on the fly.
 * This is a private function taken from their codebase.
 * Taken from https://github.com/libp2p/js-libp2p-crypto/blob/master/src/keys/ed25519-class.js
 * @param rawKey The raw private key to wrap into the libp2p format.
 */
export const marshalRawPrivateKey = (rawKey: Uint8Array): Uint8Array => {
  const protoWrapped = pbm.PrivateKey.encode({
    Data: rawKey,
    Type: pbm.KeyType.Ed25519,
  });

  return protoWrapped;
};

export const getRawPrivKeyFromIdentity = (identity: Libp2pCryptoIdentity, privKeyLength = 64): Uint8Array => {
  const src = identity.key.marshal();
  // src contains private and public key in that order, so it needs to be sliced
  return src.slice(0, privKeyLength);
};
