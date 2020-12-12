import { Identity, PrivateKey } from '@textile/crypto';
import localForage from 'localforage';

export class BrowserStorage {
  private db: LocalForage;

  constructor() {
    this.db = localForage.createInstance({ name: 'spaceids' });
  }

  async add(identity: Identity): Promise<void> {
    await this.db.setItem(identity.public.toString(), identity.toString());
  }

  async list(): Promise<Identity[]> {
    const ids: Identity[] = [];
    await this.db.iterate((value: string) => {
      try {
        // eslint-disable-next-line no-unused-expressions
        value && ids.push(PrivateKey.fromString(value));
        // eslint-disable-next-line no-empty
      } catch (e) {}
    });
    return ids;
  }

  async remove(key: string): Promise<void> {
    await this.db.setItem(key, null);
  }
}
