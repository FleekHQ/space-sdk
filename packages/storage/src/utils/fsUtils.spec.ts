import { expect } from 'chai';
import { decodeFileEncryptionKey, generateFileEncryptionKey, isMetaFileName } from './fsUtils';

describe('fsUtils', () => {
  describe('isMetaFileName', () => {
    const tests = [
      { input: '/folder/randomfile.jpg', output: false },
      { input: '/folder/randomfilewithnoextension', output: false },
      { input: '/folder/trailingslash/', output: false },
      { input: '/folder/.localized', output: true },
      { input: '/folder/.textileseed', output: true },
      { input: '/folder/.textile', output: true },
      { input: '/folder/.DS_Store', output: true },
      { input: '/folder/.Trashes', output: true },
      { input: '/folder/.localized', output: true },
    ];

    // eslint-disable-next-line mocha/no-setup-in-describe
    tests.forEach(({ input, output }) => {
      it(`isMetaFileName('${input}') returns '${output}'`, () => {
        expect(isMetaFileName(input)).to.equal(output);
      });
    });
  });

  describe('FileEncryptionKey utils', () => {
    it('should generate and decode correctly', () => {
      const newKey = generateFileEncryptionKey();
      const decodedKey = decodeFileEncryptionKey(newKey);
      expect(decodedKey).to.have.length(80);
    });

    it('should throw if invalid encryption key is decoded', () => {
      expect(() => {
        decodeFileEncryptionKey('bbaareicf6ksgnnafdkopyczls2gpovidniwnl5hn465xt5isswfubi5g6y');
      }).to.throw('Encryption key is invalid');
    });
  });
});
