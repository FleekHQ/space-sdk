import { VaultItem, VaultItemType } from '../vault';

const PK_MNEMONIC_SEP = '___';

export const getPrivateKeyFromVaultItem = (item: VaultItem): Buffer => {
  switch (item.itemType) {
    case VaultItemType.PrivateKeyWithMnemonic:
      // eslint-disable-next-line no-case-declarations
      const [privInHex, mnemonic] = item.value.split(PK_MNEMONIC_SEP);
      return Buffer.from(privInHex, 'hex');

    default:
      throw new Error('Unexpected vault item type');
  }
};

export const getVaultItemFromPrivateKey = (key: Buffer): VaultItem => ({
  itemType: VaultItemType.PrivateKeyWithMnemonic,
  value: `${key.toString('hex')}${PK_MNEMONIC_SEP}`,
});
