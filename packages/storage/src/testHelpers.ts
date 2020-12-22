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
