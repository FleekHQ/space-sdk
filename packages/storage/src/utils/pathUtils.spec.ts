import { expect } from 'chai';
import { sanitizePath } from './pathUtils';

describe('pathUtils', () => {
  describe('sanitizePath', () => {
    const tests = [
      { input: '/folder', output: '/folder' },
      { input: '/folder/', output: '/folder' },
      { input: 'folder', output: '/folder' },
      { input: 'folder/inside/', output: '/folder/inside' },
      { input: 'folder\\inside\\', output: '/folder/inside' },
    ];

    // eslint-disable-next-line mocha/no-setup-in-describe
    tests.forEach(({ input, output }) => {
      it(`sanitizePath('${input}') returns '${output}'`, () => {
        expect(sanitizePath(input)).to.equal(output);
      });
    });
  });
});
