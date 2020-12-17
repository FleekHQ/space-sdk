import { expect } from 'chai';
import { consumeStream, makeAsyncIterableString } from './streamUtils';

describe('streamUtils', () => {
  describe('consumeStream', () => {
    it('should return correct bytes data', async () => {
      const actualDataStr = 'a really long text stream broken converted to bytes iterator';
      const bytes = await consumeStream(makeAsyncIterableString(actualDataStr));
      const decodedDataStr = new TextDecoder('utf8').decode(bytes);

      expect(decodedDataStr).to.equal(actualDataStr);
    });
  });
});
