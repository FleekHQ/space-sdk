// eslint-disable-next-line max-classes-per-file
export class UnauthenticatedError extends Error {
  constructor() {
    super('Provided user is not authenticated');
  }
}

export class DirEntryNotFoundError extends Error {
  constructor(filePath: string, bucket: string) {
    super(`'${filePath}' was not found in bucket '${bucket}`);
  }
}

export class FileNotFoundError extends Error {
  constructor() {
    super('File not found');
  }
}
