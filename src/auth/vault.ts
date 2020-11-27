import axios from 'axios';
import crypto from 'crypto';

const { pbkdf2Sync } = require('crypto-browserify');

// Based on https://github.com/FleekHQ/space-daemon/blob/master/core/vault/vault.go

export enum VaultItemType {
  privateKeyWithMnemonic = 'PrivateKeyWithMnemonic',
}

export enum VkVersion {
  vkVersion1 = 'V1',
}

const PK_MNEMONIC_SEP = '___';

export interface VaultItem {
  ItemType: VaultItemType;
  Value: string;
}

// AES requires key length equal to 16, 24 or 32 bytes
const vaultKeyLength = 32;

export class Vault {
  private saltSecret: string;
  private vaultServiceUrl: string;

  constructor(vaultSaltSecret: string, vaultServiceUrl: string) {
    this.saltSecret = vaultSaltSecret;
    this.vaultServiceUrl = vaultServiceUrl;
  }

  public retrieveVault = async (uuid: string, passphrase: string): Promise<VaultItem[]> => {
    // Compute vault key
    const vk = this.computeVk(uuid, passphrase, VkVersion.vkVersion1);

    // Compute vault service key
    const vsk = this.computeVsk(vk, passphrase, VkVersion.vkVersion1);

    // Send request to vault service
    const vskBase64Enc = this.removePaddingFromBase64(vsk.toString('base64'));
    const response = await axios.post(`${this.vaultServiceUrl}/vaults/${uuid}`, {
      vsk: vskBase64Enc,
    });

    // Decrypt encrypted vault file
    const encVfBase64 = response.data.encryptedVault;
    const encVf = Buffer.from(encVfBase64, 'base64');
    const vf = this.decrypt(encVf, vk);
    const vaultItems: VaultItem[] = JSON.parse(vf);

    return vaultItems;
  };

  public getPrivateKeyFromVaultItem = (item: VaultItem): Buffer => {
    switch (item.ItemType) {
      case VaultItemType.privateKeyWithMnemonic:
        const [privInHex, mnemonic] = item.Value.split(PK_MNEMONIC_SEP);
        return Buffer.from(privInHex, 'hex');

      default:
        throw new Error('Unexpected vault item type');
    }
  };

  private computeVk = (uuid: string, passphrase: string, version: VkVersion): Buffer => {
    const iterations = 100_000;

    const encoder = new TextEncoder();
    const pass = encoder.encode(passphrase);
    const salt = encoder.encode(version + this.saltSecret + uuid);

    const key: Buffer = pbkdf2Sync(pass, salt, iterations, vaultKeyLength, 'sha512');
    return key;
  };

  private computeVsk = (vk: Buffer, passphrase: string, version: VkVersion): Buffer => {
    const iterations = 100_000;

    const encoder = new TextEncoder();
    const salt = encoder.encode(version + this.saltSecret + passphrase);

    const key: Buffer = pbkdf2Sync(vk, salt, iterations, vaultKeyLength, 'sha512');
    return key;
  };

  private decrypt = (ciphertext: Buffer, key: Buffer): string => {
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

  private removePaddingFromBase64 = (base64Str: string): string => {
    return base64Str.replace('=', '');
  };
}
