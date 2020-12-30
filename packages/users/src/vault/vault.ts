import axios from 'axios';
import crypto from 'crypto';
import { Vault, VaultBackupType, VaultItem, VaultItemType, VaultServiceConfig, VkVersion } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pbkdf2Sync } = require('crypto-browserify');

// Based on https://github.com/FleekHQ/space-daemon/blob/master/core/vault/vault.go

const PK_MNEMONIC_SEP = '___';

interface RawVaultItem {
  ItemType: VaultItemType;
  Value: string;
}

// AES requires key length equal to 16, 24 or 32 bytes
const vaultKeyLength = 32;

/**
 * SpaceVaultService implements {@link Vault} interface.
 *
 */
export class SpaceVaultService implements Vault {
  constructor(private readonly config: VaultServiceConfig) {}

  public async retrieve(uuid: string, passphrase: string, backupType: VaultBackupType): Promise<VaultItem[]> {
    const vaultKey = this.computeVaultKey(uuid, passphrase, VkVersion.vkVersion1);
    const vaultServiceKey = this.computeVaultServiceKey(vaultKey, passphrase, VkVersion.vkVersion1);

    // Send request to vault service
    const vskBase64Enc = removePaddingFromBase64(vaultServiceKey.toString('base64'));
    const response = await axios.post(`${this.config.serviceUrl}/vaults/${uuid}`, {
      vsk: vskBase64Enc,
      type: backupType,
    });

    // Decrypt encrypted vault file
    const encVfBase64 = response.data.encryptedVault;
    const encVf = Buffer.from(encVfBase64, 'base64');
    const vf = decryptVaultItemData(encVf, vaultKey);
    const vaultItems: RawVaultItem[] = JSON.parse(vf);

    return vaultItems.map((item) => ({
      itemType: item.ItemType,
      value: item.Value,
    }));
  }

  private computeVaultKey(uuid: string, passphrase: string, version: VkVersion): Buffer {
    const iterations = 100_000;

    const encoder = new TextEncoder();
    const pass = encoder.encode(passphrase);
    const salt = encoder.encode(version + this.config.saltSecret + uuid);

    const key: Buffer = pbkdf2Sync(pass, salt, iterations, vaultKeyLength, 'sha512');
    return key;
  }

  private computeVaultServiceKey(vk: Buffer, passphrase: string, version: VkVersion): Buffer {
    const iterations = 100_000;

    const encoder = new TextEncoder();
    const salt = encoder.encode(version + this.config.saltSecret + passphrase);

    const key: Buffer = pbkdf2Sync(vk, salt, iterations, vaultKeyLength, 'sha512');
    return key;
  }
}

export const getPrivateKeyFromVaultItem = (item: VaultItem): Buffer => {
  switch (item.itemType) {
    case VaultItemType.privateKeyWithMnemonic:
      // eslint-disable-next-line no-case-declarations
      const [privInHex, mnemonic] = item.value.split(PK_MNEMONIC_SEP);
      return Buffer.from(privInHex, 'hex');

    default:
      throw new Error('Unexpected vault item type');
  }
};

const decryptVaultItemData = (ciphertext: Buffer, key: Buffer): string => {
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

const removePaddingFromBase64 = (base64Str: string): string => base64Str.replace('=', '');
