import axios from 'axios';
import { Vault, VaultBackupType, VaultItem, VaultServiceConfig, VkVersion } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto-browserify');

// Based on https://github.com/FleekHQ/space-daemon/blob/master/core/vault/vault.go

// AES requires key length equal to 16, 24 or 32 bytes
const vaultKeyLength = 32;

/**
 * SpaceVaultService implements {@link Vault} interface. It interacts to space's vault service
 * to retrieve and store vault items.
 *
 */
export class SpaceVaultService implements Vault {
  constructor(private readonly config: VaultServiceConfig) {}

  public async retrieve(uuid: string, passphrase: string, backupType: VaultBackupType): Promise<VaultItem[]> {
    const vaultKey = this.computeVaultKey(uuid, passphrase, VkVersion.VkVersion1);
    const vaultServiceKey = this.computeVaultServiceKey(vaultKey, passphrase, VkVersion.VkVersion1);

    // Send request to vault service
    const vskBase64Enc = removePaddingFromBase64(vaultServiceKey.toString('base64'));
    const response = await axios.post(`${this.config.serviceUrl}/vaults/${uuid}`, {
      vsk: vskBase64Enc,
      type: backupType,
    });

    // Decrypt encrypted vault file
    const encVfBase64 = response.data.encryptedVault;
    const encryptedVaultFile = Buffer.from(encVfBase64, 'base64');
    const vf = decryptVaultItemData(encryptedVaultFile, vaultKey);

    return JSON.parse(vf);
  }

  /**
   * Store VaultItems to space fault.
   *
   * NOTE: metadata should contain a `sessionToken` field and it should be a valid hub session api token.
   *
   */
  public async store(
    uuid: string,
    passphrase: string,
    backupType: VaultBackupType,
    items: VaultItem[],
    metadata: Record<string, string>,
  ): Promise<void> {
    const { sessionToken } = metadata;
    if (!sessionToken) {
      throw new Error('Space Vault Service requires a Hub Session Token');
    }

    const vaultKey = this.computeVaultKey(uuid, passphrase, VkVersion.VkVersion1);
    const vaultServiceKey = this.computeVaultServiceKey(vaultKey, passphrase, VkVersion.VkVersion1);

    const vaultFile = JSON.stringify(items);
    const encryptedVaultFile = encryptVaultItemData(vaultFile, vaultKey);

    const requestPayload = {
      vault: removePaddingFromBase64(encryptedVaultFile.toString('base64')),
      vsk: removePaddingFromBase64(vaultServiceKey.toString('base64')),
      type: backupType,
    };

    await axios.post(`${this.config.serviceUrl}/vaults`, requestPayload, {
      headers: {
        Authorization: sessionToken,
      },
    });
  }

  private computeVaultKey(uuid: string, passphrase: string, version: VkVersion): Buffer {
    const iterations = 100_000;

    const encoder = new TextEncoder();
    const pass = encoder.encode(passphrase);
    const salt = encoder.encode(version + this.config.saltSecret + uuid);

    const key: Buffer = crypto.pbkdf2Sync(pass, salt, iterations, vaultKeyLength, 'sha512');
    return key;
  }

  private computeVaultServiceKey(vk: Buffer, passphrase: string, version: VkVersion): Buffer {
    const iterations = 100_000;

    const encoder = new TextEncoder();
    const salt = encoder.encode(version + this.config.saltSecret + passphrase);

    const key: Buffer = crypto.pbkdf2Sync(vk, salt, iterations, vaultKeyLength, 'sha512');
    return key;
  }
}

export const decryptVaultItemData = (ciphertext: Buffer, key: Buffer): string => {
  const ivLength = 12;
  const tagLength = 16;

  const iv = Buffer.allocUnsafe(ivLength);
  const tag = Buffer.allocUnsafe(tagLength);
  const data = Buffer.alloc(ciphertext.length - ivLength - tagLength, 0);

  ciphertext.copy(iv, 0, 0, ivLength);
  ciphertext.copy(tag, 0, ciphertext.length - tagLength);
  ciphertext.copy(data, 0, ivLength);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let dec = decipher.update(data, undefined, 'utf8');
  dec += decipher.final('utf8');

  return dec;
};

export const encryptVaultItemData = (data: string, key: Buffer): Buffer => {
  const ivLength = 12;
  const iv = crypto.randomBytes(ivLength);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encryptedData = cipher.update(data);
  encryptedData = Buffer.concat([iv, encryptedData, cipher.final()]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([encryptedData, authTag]);
};

const removePaddingFromBase64 = (base64Str: string): string => base64Str.replace(/=/g, '');
