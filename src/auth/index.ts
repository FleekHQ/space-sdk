import { Context } from '@textile/context';
import { createAPISig, APISig, createUserAuth, UserAuth } from '@textile/hub';
import { Libp2pCryptoIdentity } from '@textile/threads-core';
import multibase from 'multibase';
import { ed25519 } from '../utils/keys';
import { keys } from '@textile/threads-crypto';
import { Vault } from './vault';

const IDENTITY_STORE_KEY = 'a1';
const IDENTITY_CREATED_AT_STORE_KEY = 'a2';
const HUB_TOKEN_STORE_KEY = 'a3';

export interface HubAuthResponse {
  appToken: string;
  key: string;
  msg: string;
  sig: string;
  token: string;
}

class SpaceAuth {
  private tokenDuration: number;
  private servicesUrl: string;
  private vault: Vault;

  constructor(tokenDurationInMs: number, servicesUrl: string, vaultSecret: string, vaultServiceUrl: string) {
    this.tokenDuration = tokenDurationInMs;
    this.servicesUrl = servicesUrl;
    this.vault = new Vault(vaultSecret, vaultServiceUrl);
  }

  /**
   * recoverKeysByPassphrase
   */
  public async recoverKeysByPassphrase(uuid: string, passphrase: string): Promise<void> {
    const vaultItems = await this.vault.retrieveVault(uuid, passphrase);
    const privKey = this.vault.getPrivateKeyFromVaultItem(vaultItems[0]);
    const key = await keys.unmarshalPrivateKey(ed25519.marshalRawPrivateKey(privKey));
    const identity = new Libp2pCryptoIdentity(key);
    await this.logIn(identity);
  }

  /**
   * backupKeysByPassphrase
   */
  public backupKeysByPassphrase(uuid: string, passphrase: string) {}

  public async getIdentity(): Promise<Libp2pCryptoIdentity> {
    const marshalled = localStorage.getItem(IDENTITY_STORE_KEY);
    if (!marshalled) {
      throw new Error('Identity has not been initialized.');
    }
    const identity = await Libp2pCryptoIdentity.fromString(marshalled);
    return identity;
  }

  public getHubToken(): HubAuthResponse {
    if (!this.isLoggedIn()) {
      throw new Error('Identity has not been initialized.');
    }

    const hubToken = localStorage.getItem(HUB_TOKEN_STORE_KEY);
    if (!hubToken) {
      throw new Error('Auth challenge has not been completed.');
    }
    return JSON.parse(hubToken);
  }

  public isLoggedIn(): boolean {
    const identity = localStorage.getItem(IDENTITY_STORE_KEY);
    if (!identity) {
      return false;
    }

    if (this.isTokenExpired()) {
      return false;
    }

    const hubToken = localStorage.getItem(HUB_TOKEN_STORE_KEY);
    if (!hubToken) {
      return false;
    }

    return true;
  }

  private isTokenExpired() {
    const now = new Date();
    const createdAt = localStorage.getItem(IDENTITY_CREATED_AT_STORE_KEY);
    if (!createdAt) {
      return true;
    }

    const parsed = parseInt(createdAt, 10);
    if (parsed + this.tokenDuration < now.getTime()) {
      return true;
    }

    return false;
  }

  private async logIn(identity: Libp2pCryptoIdentity): Promise<void> {
    localStorage.setItem(IDENTITY_STORE_KEY, identity.toString());
    localStorage.setItem(IDENTITY_CREATED_AT_STORE_KEY, new Date().getTime().toString());

    try {
      const token = await this.completeAuthChallenge();
      localStorage.setItem(HUB_TOKEN_STORE_KEY, JSON.stringify(token));
    } catch (error) {
      throw new Error('Could not complete auth challenge: ' + error.message);
    }
  }

  private async completeAuthChallenge(): Promise<HubAuthResponse> {
    const identity = await this.getIdentity();
    const pubKeyStr = identity.public.toString();
    const socket = new WebSocket(this.servicesUrl);

    return new Promise((resolve, reject) => {
      socket.onopen = () => {
        // Request challenge
        socket.send(
          JSON.stringify({
            action: 'token',
            data: {
              pubkey: pubKeyStr,
            },
          }),
        );

        socket.onmessage = async event => {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'error': {
              reject(data.value);
              break;
            }
            case 'challenge': {
              const buf = Buffer.from(data.value);
              const signed = await identity.sign(buf);
              const dec = new TextDecoder();
              socket.send(
                JSON.stringify({
                  action: 'challenge',
                  data: {
                    pubkey: pubKeyStr,
                    sig: dec.decode(multibase.encode('base32', Buffer.from(signed))),
                  },
                }),
              );
              break;
            }
            // This is sent back when the challenge was completed successfully
            case 'token': {
              const token: HubAuthResponse = data.value;
              resolve(token);
              break;
            }
          }
        };
      };
    });
  }
}

export default SpaceAuth;
