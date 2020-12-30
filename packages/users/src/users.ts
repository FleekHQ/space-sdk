import { Identity, PrivateKey } from '@textile/crypto';
import { Libp2pCryptoIdentity } from '@textile/threads-core';
import { keys } from '@textile/threads-crypto';
import _ from 'lodash';
import 'websocket-polyfill';
import { marshalRawPrivateKey } from './utils/keysUtils';
import { getPrivateKeyFromVaultItem, SpaceVaultService, Vault, VaultBackupType, VaultServiceConfig } from './vault';

interface TextileStorageAuth {
  key: string;
  token: string;
  sig: string;
  msg: string;
}

export interface SpaceUser {
  identity: Identity;
  token: string;
  storageAuth?: TextileStorageAuth;
}

export interface IdentityStorage {
  list: () => Promise<Identity[]>;
  add: (identity: Identity) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

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
   *
   */
  /**
   * Optional {@link @spacehq/sdk#Vault} factory function.
   *
   * If provided the default VaultService with provided config will not be used for authentication.
   */
  vaultInit?: () => Vault;
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

  static async withStorage(storage: IdentityStorage, config: UsersConfig, onError?: CallableFunction) {
    const identities = await storage.list();
    const users = new Users(config, storage);
    // authenticate identities
    for (const id of identities) {
      await users.authenticate(id).catch((e) => onError && onError(e, id));
    }
    return users;
  }

  async createIdentity(): Promise<Identity> {
    const id = PrivateKey.fromRandom();
    if (this.storage) {
      await this.storage.add(id);
    }
    return id;
  }

  list(): SpaceUser[] {
    return _.values(this.users);
  }

  async remove(publicKey: string): Promise<void> {
    if (this.storage) {
      await this.storage.remove(publicKey);
    }

    this.users = _.omit(this.users, [publicKey]);
  }

  /**
   * Authenticates the identity against the hub.
   *
   * If authentication succeeds, a SpaceUser object that can be used with the UserStorage class is returned.
   *
   * @param identity - User identity
   */
  async authenticate(identity: Identity): Promise<SpaceUser> {
    return new Promise((resolve, reject) => {
      const socketUrl = `wss://${this.config.endpoint}`;

      /** Initialize our websocket connection */
      const socket = new WebSocket(socketUrl);

      /** Wait for our socket to open successfully */
      socket.onopen = () => {
        /** Get public key string */
        const publicKey = identity.public.toString();

        /** Send a new token request */
        socket.send(
          JSON.stringify({
            data: { pubkey: publicKey, version: 2 },
            action: 'token',
          }),
        );

        /** Listen for messages from the server */
        socket.onmessage = async (event) => {
          const data = JSON.parse(event.data);

          switch (data.type) {
            /** Error never happen :) */
            case 'error': {
              reject(data.value);
              break;
            }
            /** The server issued a new challenge */
            case 'challenge': {
              /** Convert the challenge json to a Buffer */
              const buf = Buffer.from(data.value.data);
              /** Use local identity to sign the challenge */
              const signed = await identity.sign(buf);

              /** Send the signed challenge back to the server */
              socket.send(
                JSON.stringify({
                  action: 'challenge',
                  data: { pubkey: publicKey, sig: Buffer.from(signed).toJSON() },
                }),
              );
              break;
            }
            /** New token generated */
            case 'token': {
              socket.close();
              const spaceUser = { ...data.value, identity };
              this.users[identity.public.toString()] = spaceUser;
              resolve(spaceUser);
              break;
            }
          }
        };
      };
    });
  }

  /**
   * Recovers users identity key information from the passphrase provided.
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
    const key = await keys.unmarshalPrivateKey(marshalRawPrivateKey(privKey));
    const identity = new Libp2pCryptoIdentity(key);
    const user = await this.authenticate(identity);
    await this.storage?.add(identity);
    return user;
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
      throw Error('Either vaultServiceConfig or vaultInit configuration is required.');
    }

    return this.vaultObj;
  }
}
