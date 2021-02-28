import path from 'path';
import multibase from 'multibase';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto-browserify');

const metaFileNames = new Map();
metaFileNames.set('.textileseed', true);
metaFileNames.set('.textile', true);
metaFileNames.set('.DS_Store', true);
metaFileNames.set('.Trashes', true);
metaFileNames.set('.localized', true);

/**
 * Checks if this is a built in file that could
 * be ignored when returning results to a client
 *
 * @param pathOrName The name of the path or file
 */
export const isMetaFileName = (pathOrName: string): boolean => {
  const name = path.basename(pathOrName);

  return metaFileNames.get(name) || false;
};

// 32 bytes aes key + 16 bytes salt/IV + 32 bytes HMAC key
export const FileEncryptionKeyLength = 32 + 16 + 32;

export const decodeFileEncryptionKey = (key: string): Uint8Array => {
  const keyBytes: Uint8Array = multibase.decode(key);
  if (keyBytes.byteLength !== FileEncryptionKeyLength) {
    throw new Error('Encryption key is invalid');
  }
  return keyBytes;
};

export const encodeFileEncryptionKey = (key: Uint8Array): string => {
  if (key.byteLength !== FileEncryptionKeyLength) {
    throw new Error('Encryption key is invalid');
  }

  const encodedKeys = multibase.encode('base32', key);
  return new TextDecoder().decode(encodedKeys);
};

export const generateFileEncryptionKey = (): string => {
  const encryptionKeyBytes: Uint8Array = crypto.randomBytes(FileEncryptionKeyLength);
  return encodeFileEncryptionKey(encryptionKeyBytes);
};
