// tslint:disable: max-classes-per-file

class BaseError extends Error {
  constructor(name: string, message: string) {
    super(`${name}: ${message}`);
    this.name = name;
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string) {
    super('AuthenticationError', message);
  }
}
