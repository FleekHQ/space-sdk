export enum VaultItemType {
  privateKeyWithMnemonic = 'PrivateKeyWithMnemonic',
}

export enum VkVersion {
  vkVersion1 = 'V1',
}

/**
 * Object representing item stored or retrieved from the vault.
 *
 */
export interface VaultItem {
  itemType: VaultItemType;
  value: string;
}

export enum VaultBackupType {
  Password = 'password',
  Google = 'google',
  Twitter = 'twitter',
  Email = 'email',
}

/**
 * Vault interface is used by the {@link @spacehq/sdk#Users} class to perform secure storage and retrieval of
 * sensitive credentials.
 *
 */
export interface Vault {
  retrieve: (uuid: string, passphrase: string, backupType: VaultBackupType) => Promise<VaultItem[]>;
}

export interface VaultServiceConfig {
  saltSecret: string;
  serviceUrl: string;
}
