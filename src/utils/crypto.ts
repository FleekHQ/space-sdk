export const hexToBytes = (hexString: string): Uint8Array => {
  const match = hexString.match(/.{1,2}/g);
  if (!match) {
    throw new Error('Malformed hex string');
  }
  return new Uint8Array(match.map(byte => parseInt(byte, 16)));
};

export const bytesToHex = (bytes: Uint8Array): string =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
