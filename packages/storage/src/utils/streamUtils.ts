// consumeStream reads through all the data from the async iterable and returns a promise of the
// aggregated bytes array.
export const consumeStream = async (iterator: AsyncIterable<Uint8Array>): Promise<Uint8Array> => {
  let bytesBuffer = new Uint8Array();
  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of iterator) {
    if (bytesBuffer.length === 0) {
      bytesBuffer = new Uint8Array(chunk.byteLength);
      bytesBuffer.set(chunk);
    } else {
      const extendedBuffer = new Uint8Array(chunk.length + bytesBuffer.length);
      extendedBuffer.set(bytesBuffer);
      extendedBuffer.set(chunk, bytesBuffer.length);
      bytesBuffer = extendedBuffer;
    }
  }

  return bytesBuffer;
};
