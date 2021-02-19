import { Mailbox, tryParsePublicKey } from '@spacehq/sdk';
import { expect, use } from 'chai';
import * as chaiSubset from 'chai-subset';
import { TestsDefaultTimeout, TestStorageConfig } from './fixtures/configs';
import { authenticateAnonymousUser } from './helpers/userHelper';

use(chaiSubset.default);

describe('Mailbox interactions', () => {
  it('should be able to setup mailbox', async () => {
    const { user } = await authenticateAnonymousUser();
    const mb = await Mailbox.createMailbox(user, TestStorageConfig);
  }).timeout(TestsDefaultTimeout);

  it('should be able to send a mail', async () => {
    const { user: user1 } = await authenticateAnonymousUser();
    const mb1 = await Mailbox.createMailbox(user1, TestStorageConfig);

    const { user: user2, identity: receipient } = await authenticateAnonymousUser();
    const mb2 = await Mailbox.createMailbox(user2, TestStorageConfig);

    const sentmsg = await mb1.sendMessage(Buffer.from(user2.identity.public.pubKey).toString('hex'), new Uint8Array(8));

    expect(sentmsg).not.to.be.null;
    expect(sentmsg.id).not.to.be.null;
    expect(sentmsg.createdAt).not.to.be.null;
    expect(sentmsg.body).not.to.be.null;
    expect(sentmsg.to).to.eq(tryParsePublicKey(Buffer.from(user2.identity.public.pubKey).toString('hex')).toString());
    expect(sentmsg.from).to.eq(tryParsePublicKey(Buffer.from(user1.identity.public.pubKey).toString('hex')).toString());

    const msgs = await mb2.listInboxMessages();
  }).timeout(TestsDefaultTimeout);
});
