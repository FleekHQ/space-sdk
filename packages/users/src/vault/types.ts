export enum VaultItemType {
  PrivateKeyWithMnemonic = 'PrivateKeyWithMnemonic',
}

export enum VkVersion {
  VkVersion1 = 'V1',
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
  /**
   * Retrieve the VaultItem that was backup for the uuid, encrypted with passphrase and backupType
   *
   */
  retrieve: (uuid: string, passphrase: string, backupType: VaultBackupType) => Promise<VaultItem[]>;

  /**
   * Store vault item for the uuid, encrypted with the passphrase and backupType
   *
   * @param metadata = Extra information that maybe required to interact with vault service.
   */
  store: (
    uuid: string,
    passphrase: string,
    backupType: VaultBackupType,
    item: VaultItem[],
    metadata: Record<string, string>,
  ) => Promise<void>;
}

export interface VaultServiceConfig {
  saltSecret: string;
  serviceUrl: string;
}
