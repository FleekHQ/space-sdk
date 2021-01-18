import { expect } from 'chai';
import { filePathFromIpfsPath, getParentPath, isTopLevelPath, reOrderPathByParents, sanitizePath } from './pathUtils';

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

  describe('isTopLevelPath', () => {
    const tests = [
      { input: '/folder', output: true },
      { input: 'a.txt/', output: true },
      { input: '/folder/a.txt', output: false },
      { input: '/folder/inner/right', output: false },
      { input: 'a.txt', output: true },
      { input: 'folder', output: true },
    ];

    // eslint-disable-next-line mocha/no-setup-in-describe
    tests.forEach(({ input, output }) => {
      it(`isTopLevelPath('${input}') returns '${output}'`, () => {
        expect(isTopLevelPath(input)).to.equal(output);
      });
    });
  });

  describe('getParentPath', () => {
    const tests = [
      { input: '/folder', output: '/' },
      { input: '/folder/', output: '/' },
      { input: 'folder', output: '/' },
      { input: 'folder/inside', output: '/folder' },
      { input: '/', output: '/' },
    ];

    // eslint-disable-next-line mocha/no-setup-in-describe
    tests.forEach(({ input, output }) => {
      it(`getParentPath('${input}') returns '${output}'`, () => {
        expect(getParentPath(input)).to.equal(output);
      });
    });
  });

  describe('reOrderPathByParents', () => {
    const tests = [
      {
        input: ['a.txt', '/a/b.txt', '/a/c/d.txt', '/a/e.txt', 'f.txt'],
        output: ['a.txt', 'f.txt', '/a/b.txt', '/a/e.txt', '/a/c/d.txt'],
      },
      {
        input: ['a.txt'], output: ['a.txt'],
      },
    ];

    // eslint-disable-next-line mocha/no-setup-in-describe
    tests.forEach(({ input, output }) => {
      it(`reOrderPathByParents('${input}') returns '${output}'`, async () => {
        const result = reOrderPathByParents(input, (it) => it);
        const actualOutput: string[] = [];

        await result.traverseLevels(async (leaf) => {
          actualOutput.push(...leaf);
        });

        expect(actualOutput).to.deep.equal(output);
      });
    });
  });

  describe('filePathFromIpfsPath', () => {
    const tests = [
      {
        input: '/ipfs/bafybeifyipelgeu75bzjnrw5l5xpp4nmllh3owzk5o7qci7gtatstgdoam/.textileseed',
        output: '/.textileseed',
      },
      {
        input: '/ipfs/bafybeifyipelgeu75bzjnrw5l5xpp4nmllh3owzk5o7qci7gtatstgdoam/top.txt',
        output: '/top.txt',
      },
    ];

    // eslint-disable-next-line mocha/no-setup-in-describe
    tests.forEach(({ input, output }) => {
      it(`filePathFromIpfsPath('${input}') returns '${output}'`, async () => {
        const actualOutput = filePathFromIpfsPath(input);
        expect(actualOutput).to.deep.equal(output);
      });
    });
  });
});
