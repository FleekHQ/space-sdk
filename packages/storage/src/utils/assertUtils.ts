import { ValidationError } from '../errors';

export const validateNonEmptyArray = (fieldName: string, array?: any[]) => {
  if (!array || array.length === 0) {
    throw new ValidationError(fieldName, 'must be a non empty array');
  }
};
