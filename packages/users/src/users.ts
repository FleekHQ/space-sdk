// import log from 'loglevel'
import { PrivateKey, Identity } from '@textile/crypto';
import multibase from 'multibase';

// const logger = log.getLogger('users');

interface UsersConfig {
  endpoint: string;
}

interface TextileStorageAuth {
  key: string;
  token: string;
  sig: string;
  msg: string;
}

interface SpaceUser {
  identity: Identity;
  token: string;
  storageAuth?: TextileStorageAuth;
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
 * Initialize a the User API and list their threads.
 * ```typescript
 * import { Users } from '@space/users'
 *
 * const users = new Users({ endpoint: "users.space.storage" });
 *
 * // create new key pair
 * const id = users.createIdentity();
 *
 * // authenticate against ws challenge, obtaining storageAuth
 * const user = await users.authenticate(id);
 * ```
 */
export class Users {
  private config: UsersConfig;

  constructor(config: UsersConfig) {
    this.config = config;
  }

  createIdentity(): Identity {
    return PrivateKey.fromRandom();
  }

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
            data: { pubkey: publicKey },
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
              const buf = Buffer.from(data.value);
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

              // should we register user like users.push(user)
              // so we can provide feature for listing signed users / accounts?
              // or we can leave that for app-specific code
              resolve(spaceUser);
              break;
            }
          }
        };
      };
    });
  }
}
