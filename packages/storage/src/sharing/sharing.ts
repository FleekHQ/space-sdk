import { FullPath, Invitation, InvitationStatus } from '../types';
import { UserMetadataStore, BucketMetadata } from '../metadata/metadataStore';

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

  const buckets = [];
  const enhancedPaths:FullPath[] = [];

  const bucketsAndEnhancedPaths = await Promise.all(paths.map(async (path) => {
    const b = await store.findBucket(path.bucket);
    return [b, {
      ...path,
      dbId: b?.dbId,
      bucketKey: b?.bucketKey,
    }];
  }));

  const keysP = bucketsAndEnhancedPaths.map((o) => (o[0] as BucketMetadata).encryptionKey);
  const keys = await Promise.all(keysP);

  const keysCleaned: Uint8Array[] = keys.map((k) => {
    if (!k) {
      throw new Error('Required encryption key not found');
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
