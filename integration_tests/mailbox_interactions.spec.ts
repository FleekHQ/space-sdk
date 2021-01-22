import { BrowserStorage, Users, UserStorage, VaultBackupType, Mailbox, tryParsePublicKey } from '@spacehq/sdk';
import { Update, ThreadID, InboxListOptions, UserAuth, UserMessage, PrivateKey, Public, privateKeyFromString, PublicKey } from '@textile/hub';
import { expect, use } from 'chai';
import * as chaiSubset from 'chai-subset';
import { TestsDefaultTimeout, TestUsersConfig } from './fixtures/configs';
import { authenticateAnonymousUser } from './helpers/userHelper';

use(chaiSubset.default);

describe('Mailbox interactions', () => {
  it('should be able to setup mailbox', async () => {
    const { user } = await authenticateAnonymousUser();
    const mb = await Mailbox.CreateMailbox(user);
  }).timeout(TestsDefaultTimeout);

  it('should be able to send a mail', async () => {
    const { user: user1 } = await authenticateAnonymousUser();
    const mb1 = await Mailbox.CreateMailbox(user1);

    const { user: user2, identity: receipient } = await authenticateAnonymousUser();
    const mb2 = await Mailbox.CreateMailbox(user2);

    const sentmsg = await mb1.SendMessage(Buffer.from(user2.identity.public.pubKey).toString('hex'), new Uint8Array(8));

    expect(sentmsg).not.to.be.null;
    expect(sentmsg.id).not.to.be.null;
    expect(sentmsg.createdAt).not.to.be.null;
    expect(sentmsg.body).not.to.be.null;
    expect(sentmsg.to).to.eq(tryParsePublicKey(Buffer.from(user2.identity.public.pubKey).toString('hex')).toString());
    expect(sentmsg.from).to.eq(tryParsePublicKey(Buffer.from(user1.identity.public.pubKey).toString('hex')).toString());
  }).timeout(TestsDefaultTimeout);
});
