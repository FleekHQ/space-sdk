import crypto from 'crypto';
import path from 'path';
import multibase from 'multibase';
import { AddItemDataType } from '../types';
import { CursorBuffer } from './CursorBuffer';

// eslint-disable-next-line @typescript-eslint/no-var-requires
// const crypto = require('crypto-browserify');

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
const AesKeyLength = 32;
const IVBytesLength = 16;
const HmacKeyLength = 32;
export const FileEncryptionKeyLength = AesKeyLength + IVBytesLength + HmacKeyLength;

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

const isBytes = (obj: Buffer | ArrayBuffer): boolean => (
  Buffer.isBuffer(obj)
  || ArrayBuffer.isView(obj)
  || obj instanceof ArrayBuffer
);

const isBloby = (obj: any): boolean => (
  // eslint-disable-next-line no-undef
  typeof globalThis.Blob !== 'undefined' && obj instanceof globalThis.Blob
);

/**
 * Encrypts the data and returns a readable stream to read the encrypted data
 *
 */
export const newEncryptedDataWriter = (
  data: AddItemDataType,
  key: Uint8Array,
): AsyncIterable<Uint8Array> => {
  const keyReader = new CursorBuffer(key);
  const aesKey = keyReader.readXBytes(AesKeyLength);
  const ivBytes = keyReader.readXBytes(IVBytesLength);

  // TODO; Calculate streaming Hmac and append to end of file
  // const hmacKey = keyReader.readXBytes(HmacKeyLength);

  const cipher = crypto.createCipheriv('aes-256-ctr', aesKey, ivBytes);

  // eslint-disable-next-line func-names
  return (async function* () {
    // handle strings
    if (typeof data === 'string') {
      const output = cipher.update(data);
      const finalOutput = Buffer.concat([output, cipher.final()]);
      yield finalOutput;
      return;
    }

    // handle array buffers
    if (isBytes(data as ArrayBuffer)) {
      const output = cipher.update(new Uint8Array(data as ArrayBuffer));
      const finalOutput = Buffer.concat([output, cipher.final()]);
      yield finalOutput;
      return;
    }

    // Handle Blob and Files
    if (isBloby(data)) {
      const blob = data as Blob;
      // eslint-disable-next-line no-undef
      const reader = new globalThis.FileReader();
      const chunkSize = 1024 * 1024;
      let offset = 0;

      const getNextChunk = () => new Promise<ArrayBuffer | null>((resolve, reject) => {
        reader.onloadend = (e) => {
          const readData = e.target?.result as ArrayBuffer;
          resolve(readData.byteLength === 0 ? null : readData);
        };
        reader.onerror = reject;

        const end = offset + chunkSize;
        const slice = blob.slice(offset, end);
        reader.readAsArrayBuffer(slice);
        offset = end;
      });

      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const readBytes = await getNextChunk();

        if (readBytes == null) {
          yield cipher.final();
          return;
        }
        yield cipher.update(new Uint8Array(readBytes));
      }
    }

    // Browser stream
    if (typeof (data as ReadableStream).getReader === 'function') {
      const reader = (data as ReadableStream).getReader();
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const readBytes = await reader.read();
        if (readBytes.done) {
          const finalOutput = cipher.final();
          yield finalOutput;
          return;
        }
        const output = cipher.update(readBytes.value);
        yield output;
      }
    }

    throw new Error(`Unexpected uploaded data format: ${typeof data}`);
  }());
};

/**
 * Returns an async iterable of decoded bytes.
 *
 */
export const newDecryptedDataReader = (
  data: AsyncIterableIterator<Uint8Array>,
  key: Uint8Array,
): AsyncIterableIterator<Uint8Array> => {
  const keyReader = new CursorBuffer(key);
  const aesKey = keyReader.readXBytes(AesKeyLength);
  const ivBytes = keyReader.readXBytes(IVBytesLength);

  // TODO; Calculate streaming Hmac and append to end of file
  // const hmacKey = keyReader.readXBytes(HmacKeyLength);

  const decipher = crypto.createDecipheriv('aes-256-ctr', aesKey, ivBytes);
  // eslint-disable-next-line require-yield,func-names
  return (async function* () {
    // eslint-disable-next-line no-restricted-syntax
    for await (const encryptedData of data) {
      const decryptedData = decipher.update(encryptedData);
      yield decryptedData;
    }
    yield decipher.final();
  }());
};
