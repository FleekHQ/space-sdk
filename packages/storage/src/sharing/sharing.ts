import { FullPath, Invitation, InvitationStatus } from '../types';
import { UserMetadataStore } from '../metadata/metadataStore';

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

  const bucketsP = paths.map((path) => store.findBucket(path.bucket));
  const buckets = await Promise.all(bucketsP);
  const keysP = buckets.map((b) => b?.encryptionKey);
  const keys = await Promise.all(keysP);

  const keysCleaned: Uint8Array[] = keys.map((k) => {
    if (!k) {
      throw new Error('Required encryption key not found');
    }
    return k;
  });

  pubkeys.forEach((pubkey) => {
    const invite:Invitation = {
      inviteePublicKey: inviter,
      inviterPublicKey: pubkey,
      itemPaths: paths,
      status: InvitationStatus.PENDING,
      keys: keysCleaned,
    };

    invites.push(invite);
  });

  return invites;
};
