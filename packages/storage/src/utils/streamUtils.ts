// makeStringAsyncIterator is testing utility function used internal to generate iterables from strings.
export const makeAsyncIterableString = (data: string): AsyncIterable<Uint8Array> => {
  const encoder = new TextEncoder();
  let index = 0;
  const iterator = () => ({
    next: async (...args: []): Promise<IteratorResult<Uint8Array>> => {
      if (index < data.length) {
        return Promise.resolve({
          // eslint-disable-next-line no-plusplus
          value: encoder.encode(data.charAt(index++)),
          done: false,
        });
      }
      return Promise.resolve({
        value: null,
        done: true,
      });
    },
  });

  return {
    [Symbol.asyncIterator]: iterator,
    ...iterator(),
  };
};

export const consumeStream = async (iterator: AsyncIterable<Uint8Array>): Promise<Uint8Array> => {
  let bytesBuffer = new Uint8Array();
  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of iterator) {
    if (bytesBuffer.length === 0) {
      bytesBuffer = chunk;
    } else {
      const extendedBuffer = new Uint8Array(chunk.length + bytesBuffer.length);
      extendedBuffer.set(bytesBuffer);
      extendedBuffer.set(chunk, bytesBuffer.length);
      bytesBuffer = extendedBuffer;
    }
  }

  return bytesBuffer;
};
