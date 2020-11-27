import SpaceAuth from '../auth';
import SpaceService from '../service';
import { SpaceAPIOpts } from './types';

interface SpaceAPIOptsDefaulted {
  hubUrl: string;
  sessionDurationInMs: number;
  spaceServicesAuthUrl: string;
  vaultSaltSecret: string;
  vaultServiceUrl: string;
  hubMultiaddress: string;
}

const defaultOpts: SpaceAPIOptsDefaulted = {
  hubMultiaddress: '/ip4/52.186.99.239/tcp/4006/p2p/12D3KooWQEtCBXMKjVas6Ph1pUHG2T4Lc9j1KvnAipojP2xcKU7n',
  hubUrl: '',
  sessionDurationInMs: 1000 * 60 * 30, // 30 min
  spaceServicesAuthUrl: 'wss://auth.space.storage',
  vaultSaltSecret: 'WXpKd2JrMUlUbXhhYW10M1RWUkNlV0Z0YkhCYU1tUn',
  vaultServiceUrl: 'https://vault.space.storage',
};

class SpaceAPI {
  private auth: SpaceAuth;
  private service: SpaceService;

  constructor(opts: SpaceAPIOpts = {}) {
    const optsWithDefaults = {
      ...defaultOpts,
      ...opts,
    };

    this.auth = new SpaceAuth(
      optsWithDefaults.sessionDurationInMs,
      optsWithDefaults.spaceServicesAuthUrl,
      optsWithDefaults.vaultSaltSecret,
      optsWithDefaults.vaultServiceUrl,
    );
    this.service = new SpaceService(this.auth, optsWithDefaults.hubUrl, optsWithDefaults.hubMultiaddress);
  }

  public async recoverKeysByPassphrase(uuid: string, passphrase: string) {
    await this.auth.recoverKeysByPassphrase(uuid, passphrase);
  }

  public async listDirectory(path: string, bucket: string) {
    await this.ensureLoggedIn();

    this.service.listDirectory(path, bucket);
  }

  public isLoggedIn() {
    return this.auth.isLoggedIn();
  }

  private async ensureLoggedIn() {
    if (!this.auth.isLoggedIn()) {
      throw new Error('This method requires the user to be logged in');
    }
  }
}

export default SpaceAPI;
