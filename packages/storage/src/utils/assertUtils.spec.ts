import { expect } from 'chai';
import { ValidationError } from '../errors';
import { validateNonEmptyArray } from './assertUtils';

describe('validateNonEmptyArray', () => {
  it('should throw if array is undefined', () => {
    const testArray: string[] | undefined = undefined;
    expect(() => validateNonEmptyArray('testArray', testArray)).to.throw(ValidationError);
  });

  it('should throw if array is empty', () => {
    const testArray: string[] = [];
    expect(() => validateNonEmptyArray('testArray', testArray)).to.throw(ValidationError);
  });

  it('should not throw for non empty array', () => {
    const testArray: number[] = [1];
    expect(() => validateNonEmptyArray('testArray', testArray)).not.to.throw(ValidationError);
  });
});
