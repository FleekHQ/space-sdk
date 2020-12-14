import { Identity, PrivateKey } from '@textile/crypto';
import fs from 'fs';
import _ from 'lodash';

// experimental, do not use yet
export class FileStorage {
  private filename: string;

  private identities: Record<string, string>;

  constructor(filename: string) {
    this.filename = filename;

    const jsonString = (fs.existsSync(filename) && fs.readFileSync(filename).toString()) || '{}';
    this.identities = JSON.parse(jsonString);
  }

  private async write(): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(this.filename, JSON.stringify(this.identities), (err) => {
        // eslint-disable-next-line no-unused-expressions
        err ? reject(err) : resolve();
      });
    });
  }

  async add(identity: Identity): Promise<void> {
    this.identities[identity.public.toString()] = identity.toString();
    await this.write();
  }

  async list(): Promise<Identity[]> {
    return _.values(this.identities).map((idString) => PrivateKey.fromString(idString));
  }

  async remove(key: string): Promise<void> {
    this.identities = _.omit(this.identities, [key]);
    await this.write();
  }
}
