import { FullPath, Invitation, InvitationStatus } from '../types';
import { UserMetadataStore } from '../metadata/metadataStore';
import { decodeFileEncryptionKey } from '../utils/fsUtils';

/**
 * Makes invitation objects that could then be
 * later sent to recipients
 *
 */
export const createFileInvitations = async (
  inviter: string,
  paths: FullPath[],
  pubkeys: string[],
  store: UserMetadataStore,
): Promise<Invitation[]> => {
  const invites:Invitation[] = [];

  const bucketsAndEnhancedPaths = await Promise.all(paths.map(async (path) => {
    const f = await store.findFileMetadata(path.bucket, path.dbId || '', path.path);
    const encryptionKey = f?.encryptionKey;
    return [encryptionKey, {
      ...path,
      uuid: f?.uuid,
      dbId: f?.dbId,
      bucketKey: f?.bucketKey,
    }];
  }));

  const keys = bucketsAndEnhancedPaths.map((o) => o[0] as string);
  const keysCleaned: string[] = keys.map((k) => {
    if (!k) {
      throw new Error('Required encryption key for invitation not found');
    }
    return k;
  });

  pubkeys.forEach((pubkey) => {
    const invite:Invitation = {
      inviteePublicKey: pubkey,
      inviterPublicKey: inviter,
      itemPaths: bucketsAndEnhancedPaths.map((o) => o[1] as FullPath),
      status: InvitationStatus.PENDING,
      keys: keysCleaned,
    };

    invites.push(invite);
  });

  return invites;
};
