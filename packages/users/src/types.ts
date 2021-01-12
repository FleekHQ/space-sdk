/**
 * Identity represents an entity capable of signing a message.
 * This is a simple "private key" interface that must be capable of returning
 * the associated "public key" for verification. In many cases, the Identity
 * will just be a private key.
 *
 */
// The interface is currently modeled after `libp2p-crypto` keys.
// It is meant to be implemented by external libraries, though in practice,
// implementations are provided by the `@textile/crypto` library.
export interface Identity {
  /**
   * Sign the message using this identity and return the signature.
   * @param data The data (raw bytes) to sign.
   */
  sign(data: Uint8Array): Promise<Uint8Array>;

  /**
   * Raw private key bytes of this identity
   *
   */
  privKey: Uint8Array;

  /**
   * Get the public key associated with this identity. This can be any object
   * that satisfies the {@link Public} interface.
   */
  public: Public;
}

/**
 * Public is any entity associated with a given {@link Identity} that is
 * capable of verifying a signature produced by said identity. In most cases,
 * a public key will be obtained as a property of an object implementing the
 * {@link Identity} key interface.
 */
export interface Public {
  /**
   * Verifies the signature for the data and returns true if verification
   * succeeded or false if it failed.
   * @param data The data to use for verification.
   * @param sig The signature to verify.
   */
  verify(data: Uint8Array, sig: Uint8Array): Promise<boolean>;

  /**
   * Raw public keys bytes
   */
  pubKey: Uint8Array;

  /**
   * Return the protobuf-encoded bytes of this public key.
   */
  bytes: Uint8Array;
}
