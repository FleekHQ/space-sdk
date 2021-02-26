import { authenticateSpaceIdentity, HubAuthResponse, TextileStorageAuth } from '@spacehq/utils';
import { PrivateKey } from '@textile/crypto';
import _ from 'lodash';
import 'websocket-polyfill';
import { Identity } from './types';
import { getPrivateKeyFromVaultItem, getVaultItemFromPrivateKey } from './utils/vaultUtils';
import { SpaceVaultService, Vault, VaultBackupType, VaultServiceConfig } from './vault';

/**
 * Represents an authenticated KeyPair identity with valid API session token.
 *
 */
export interface SpaceUser {
  identity: Identity;
  /**
   * Auth endpoint used to authenticate this user
   */
  endpoint: string;
  /**
   * token is the service token. It can be used to interact with the identity service.
   *
   */
  token: string;
  storageAuth?: TextileStorageAuth;
}

/**
 * An IdentityStorage handles persistence of Identity for the {@link Users} class.
 *
 * The sdk provides two implementation for this.
 * See {@link @spacehq/sdk#BrowserStorage} and {@link @spacehq/sdk#FileStorage}.
 */
export interface IdentityStorage {
  list: () => Promise<Identity[]>;
  add: (identity: Identity) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

const privateKeyBytes = 32;

/**
 * Configuration option provided to the {@link Users} class.
 *
 */
export interface UsersConfig {
  /**
   * Hub auth service endpoint
   *
   */
  endpoint: string;
  /**
   * Vault Service Configuration. Either this is provided or the `vaultInit` function is provided
   * or else initializing the users class will throw an error.
   *
   */
  vaultServiceConfig?: VaultServiceConfig;
  /**
   * Optional {@link @spacehq/sdk#Vault} factory function.
   *
   * If provided the default VaultService with provided config will not be used for authentication.
   */
  vaultInit?: () => Vault;
  authChallengeSolver?: (identity: Identity) => Promise<HubAuthResponse>;
}

/**
 * Users a client wrapper for interacting with the Textile Users API.
 *
 * This API has the ability to:
 *
 *   - Create new identity
 *
 *   - Authenticate via identity against ws challenge
 *
 *
 * @example
 * Initialize Users without identity storage
 * ```typescript
 * import { Users } from '@spacehq/users'
 *
 * const users = new Users({ endpoint: "users.space.storage" });
 *
 * // create new key pair
 * const id = users.createIdentity();
 *
 * // authenticate against ws challenge, obtaining storageAuth
 * const user = await users.authenticate(id);
 * ```
 *
 * @example
 * Initialize Users with BrowserStorage
 * ```typescript
 * import { Users, BrowserStorage } from '@spacehq/users'
 *
 * const storage = new BrowserStorage();
 * // error is thrown when identity fails to auth
 * const onErrorCallback = (err, identity) => { ... };
 *
 * // users are automatically restored from stored identities
 * const users = await Users.withStorage(storage, { endpoint: "users.space.storage" }, onErrorCallback);
 *
 * ```
 */
export class Users {
  private config: UsersConfig;

  private storage?: IdentityStorage;

  private users: Record<string, SpaceUser>;

  private vaultObj?: Vault;

  constructor(config: UsersConfig, storage?: IdentityStorage) {
    this.config = config;
    this.storage = storage;
    this.users = {};
  }

  /**
   * Creates a users
   */
  static async withStorage(storage: IdentityStorage, config: UsersConfig, onError?: CallableFunction) {
    const identities = await storage.list();
    const users = new Users(config, storage);
    // authenticate identities
    await Promise.all(identities.map(async (id: Identity) => {
      await users.authenticate(id).catch((e) => onError && onError(e, id));
    }));
    return users;
  }

  /**
   * createIdentity generates a random keypair identity.
   *
   */
  async createIdentity(): Promise<Identity> {
    const id = PrivateKey.fromRandom();
    if (this.storage) {
      await this.storage.add(id);
    }
    return id;
  }

  /**
   * List all in memory {@link SpaceUser} that have been authenticated so far.
   *
   */
  list(): SpaceUser[] {
    return _.values(this.users);
  }

  /**
   * Removes the users identity from list of authenticated users.
   *
   * It also removes the identity from the {@link IdentityStorage} provided.
   *
   * @param publicKey - public key of users identity
   */
  async remove(publicKey: string): Promise<void> {
    if (this.storage) {
      await this.storage.remove(publicKey);
    }

    this.users = _.omit(this.users, [publicKey]);
  }

  /**
   * Authenticates the random keypair identity against the hub. Generating an appToken API Session token.
   *
   * If authentication succeeds, a SpaceUser object that can be used with the UserStorage class is returned.
   *
   * @param identity - User identity
   */
  async authenticate(identity: Identity): Promise<SpaceUser> {
    let storageAuth: HubAuthResponse;
    if (this.config.authChallengeSolver) {
      storageAuth = await this.config.authChallengeSolver(identity);
    } else {
      storageAuth = await authenticateSpaceIdentity(this.config.endpoint, identity as PrivateKey);
    }

    const spaceUser = { ...storageAuth, identity, endpoint: this.config.endpoint };
    this.users[identity.public.toString()] = spaceUser;

    return spaceUser;
  }

  /**
   * Recovers users identity key information using the passphrase provided.
   *
   * If successfully recovered, the users information is stored in the `IdentityStorage` (if provided)
   * when initializing the users class.
   *
   * @param uuid - users unique vault id
   * @param passphrase - users passphrase used to recover keys
   * @param backupType - Type of vault backup the passphrase originates from
   */
  public async recoverKeysByPassphrase(
    uuid: string,
    passphrase: string,
    backupType: VaultBackupType,
  ): Promise<SpaceUser> {
    const vaultItems = await this.vault.retrieve(uuid, passphrase, backupType);
    const privKey = getPrivateKeyFromVaultItem(vaultItems[0]);
    const identity = new PrivateKey(privKey.slice(0, privateKeyBytes));
    const user = await this.authenticate(identity);
    await this.storage?.add(identity);
    return user;
  }

  /**
   * Backup the existing users identity key information using the passphrase provided.
   *
   * `Identity` can be gotten from {@link @spacehq/sdk#SpaceUser} gotten after a successful authentication
   * or recovery.
   *
   * @param uuid - users unique vault id
   * @param passphrase - users passphrase used to recover keys
   * @param backupType - Type of vault backup the passphrase originates from
   * @param identity - Identity containing private key of user to backup
   */
  public async backupKeysByPassphrase(
    uuid: string,
    passphrase: string,
    backupType: VaultBackupType,
    identity: Identity,
  ): Promise<void> {
    const user = await this.authenticate(identity);

    const pk = await this.getPrivKeyFromIdentity(identity);
    await this.vault.store(uuid, passphrase, backupType, [getVaultItemFromPrivateKey(Buffer.from(pk))], {
      sessionToken: user.token,
    });
  }

  private get vault(): Vault {
    if (this.vaultObj) {
      return this.vaultObj;
    }

    if (this.config.vaultInit) {
      this.vaultObj = this.config.vaultInit();
    } else if (this.config.vaultServiceConfig) {
      this.vaultObj = new SpaceVaultService(this.config.vaultServiceConfig);
    } else {
      throw new Error('Either vaultServiceConfig or vaultInit configuration is required.');
    }

    return this.vaultObj;
  }

  /**
   * Tries to get the private key from the Identity object provided.
   * if none found, then tries to get it from the identity storage if provided
   *
   * @private
   */
  private async getPrivKeyFromIdentity(identity: Identity): Promise<Uint8Array> {
    if ((identity as PrivateKey).privKey) {
      return (identity as PrivateKey).privKey;
    }

    // check users cache
    if (this.users[identity.public.toString()]) {
      const user = this.users[identity.public.toString()];
      if ((user.identity as PrivateKey).privKey) {
        return (user.identity as PrivateKey).privKey;
      }
    }

    // check identity storage
    if (this.storage) {
      const identities = await this.storage.list();
      const foundPk = identities.find((value) => value.public.toString() === identity.public.toString());
      if (foundPk && (foundPk as PrivateKey).privKey) {
        return (foundPk as PrivateKey).privKey;
      }
    }

    throw new Error('identity provided is not a valid PrivateKey Identity.');
  }
}
