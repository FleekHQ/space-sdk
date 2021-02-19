/* eslint-disable no-unused-expressions */
import { AddItemsEventData,
  AddItemsResultSummary,
  UserStorage,
  ShareKeyType, Notification, NotificationType, NotificationSubscribeEventData } from '@spacehq/sdk';
import { tryParsePublicKey } from '@spacehq/utils';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import { TestsDefaultTimeout, TestStorageConfig } from './fixtures/configs';
import { authenticateAnonymousUser } from './helpers/userHelper';

use(chaiAsPromised.default);
use(chaiSubset.default);

describe('Users sharing data', () => {
  it('users can share, accept and view shared files', async () => {
    const { user } = await authenticateAnonymousUser();
    const txtContent = 'Some manual text should be in the file';

    const storage = new UserStorage(user, TestStorageConfig);
    const uploadResponse = await storage.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'top.txt',
          data: txtContent,
          mimeType: 'plain/text',
        },
      ],
    });

    const addItemsData = await new Promise<AddItemsEventData>((resolve) => {
      uploadResponse.once('done', resolve);
    });

    // share with new user
    const shareResult = await storage.shareViaPublicKey({
      publicKeys: [{
        id: 'new-space-user@fleek.co',
      }],
      paths: [{
        bucket: 'personal',
        path: '/top.txt',
      }],
    });

    expect(shareResult.publicKeys).not.to.be.empty;
    expect(shareResult.publicKeys[0].type).to.equal(ShareKeyType.Temp);
    expect(shareResult.publicKeys[0].tempKey).not.to.be.empty;

    // TODO: verify new user can access file via uuid
  }).timeout(TestsDefaultTimeout);

  it('users can share file using public key', async () => {
    const { user } = await authenticateAnonymousUser();
    const { user: receiver } = await authenticateAnonymousUser();
    const receiverPk = Buffer.from(receiver.identity.public.pubKey).toString('hex');
    const txtContent = 'Some manual text should be in the file';

    const storage = new UserStorage(user, TestStorageConfig);
    const uploadResponse = await storage.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'top.txt',
          data: txtContent,
          mimeType: 'plain/text',
        },
      ],
    });

    await new Promise<AddItemsEventData>((resolve) => {
      uploadResponse.once('done', resolve);
    });

    // init mailbox
    await storage.initMailbox();
    const receiverStorage = new UserStorage(receiver, TestStorageConfig);
    await receiverStorage.initMailbox();

    // share with new user
    const shareResult = await storage.shareViaPublicKey({
      publicKeys: [{
        id: 'new-space-user@fleek.co',
        pk: receiverPk,
      }],
      paths: [{
        bucket: 'personal',
        path: '/top.txt',
      }],
    });

    expect(shareResult.publicKeys).not.to.be.empty;
    expect(shareResult.publicKeys[0].type).to.equal(ShareKeyType.Existing);
    expect(shareResult.publicKeys[0].pk).not.to.be.empty;
  }).timeout(TestsDefaultTimeout);

  it('users can receive share invitations', async () => {
    const { user: user1 } = await authenticateAnonymousUser();
    const { user: user2 } = await authenticateAnonymousUser();
    const user1Pk = Buffer.from(user1.identity.public.pubKey).toString('hex');
    const user2Pk = Buffer.from(user2.identity.public.pubKey).toString('hex');

    const txtContent = 'Some manual text should be in the file';

    const storage1 = new UserStorage(user1, TestStorageConfig);
    const uploadResponse = await storage1.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'top.txt',
          data: txtContent,
          mimeType: 'plain/text',
        },
      ],
    });

    await new Promise<AddItemsEventData>((resolve) => {
      uploadResponse.once('done', resolve);
    });

    await storage1.initMailbox();

    const storage2 = new UserStorage(user2, TestStorageConfig);
    await storage2.initMailbox();

    // share with new user
    const shareResult = await storage1.shareViaPublicKey({
      publicKeys: [{
        id: 'new-space-user@fleek.co',
        pk: user2Pk,
      }],
      paths: [{
        bucket: 'personal',
        path: '/top.txt',
      }],
    });

    expect(shareResult.publicKeys).not.to.be.empty;
    expect(shareResult.publicKeys[0].type).to.equal(ShareKeyType.Existing);
    expect(shareResult.publicKeys[0].pk).not.to.be.empty;

    const received = await storage2.getNotifications();
    expect(received.notifications[0]).not.to.be.null;
    expect(received.notifications[0].from).to.equal(tryParsePublicKey(user1Pk).toString());
    expect(received.notifications[0].to).to.equal(tryParsePublicKey(user2Pk).toString());
    expect(received.notifications[0].id).not.to.be.null;
    expect(received.notifications[0].createdAt).not.to.be.null;
    expect(received.notifications[0].type).to.equal(NotificationType.INVITATION);
    expect(received.notifications[0].relatedObject).not.to.be.null;
    expect(received.notifications[0].relatedObject?.inviteePublicKey).to.equal(user2Pk);
    expect(received.notifications[0].relatedObject?.inviterPublicKey).to.equal(user1Pk);
    expect(received.notifications[0].relatedObject?.itemPaths[0].bucket).to.equal('personal');
    expect(received.notifications[0].relatedObject?.itemPaths[0].path).to.equal('/top.txt');
    expect(received.notifications[0].relatedObject?.itemPaths[0].dbId).not.to.be.null;
    expect(received.notifications[0].relatedObject?.itemPaths[0].bucketKey).not.to.be.null;
    expect(received.notifications[0].relatedObject?.keys[0]).not.to.be.null;
  }).timeout(TestsDefaultTimeout);

  it('users can receive sharing notifications subscription events', async () => {
    const { user: user1 } = await authenticateAnonymousUser();
    const { user: user2 } = await authenticateAnonymousUser();
    const user1Pk = Buffer.from(user1.identity.public.pubKey).toString('hex');
    const user2Pk = Buffer.from(user2.identity.public.pubKey).toString('hex');

    const txtContent = 'Some manual text should be in the file';

    const storage1 = new UserStorage(user1, TestStorageConfig);
    const uploadResponse = await storage1.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'top.txt',
          data: txtContent,
          mimeType: 'plain/text',
        },
      ],
    });

    await new Promise<AddItemsEventData>((resolve) => {
      uploadResponse.once('done', resolve);
    });

    await storage1.initMailbox();

    const storage2 = new UserStorage(user2, TestStorageConfig);
    await storage2.initMailbox();

    const ee = await storage2.notificationSubscribe();

    const eventData = new Promise<NotificationSubscribeEventData>((resolve) => {
      ee.once('data', (d:NotificationSubscribeEventData) => resolve(d));
    });

    // share with new user
    const shareResult = await storage1.shareViaPublicKey({
      publicKeys: [{
        id: 'new-space-user@fleek.co',
        pk: user2Pk,
      }],
      paths: [{
        bucket: 'personal',
        path: '/top.txt',
      }],
    });

    const data = await eventData;
    expect(shareResult.publicKeys).not.to.be.empty;
    expect(shareResult.publicKeys[0].type).to.equal(ShareKeyType.Existing);
    expect(shareResult.publicKeys[0].pk).not.to.be.empty;
    expect(data.notification).not.to.be.null;
    expect(data.notification.from).to.equal(tryParsePublicKey(user1Pk).toString());
    expect(data.notification.to).to.equal(tryParsePublicKey(user2Pk).toString());
    expect(data.notification.id).not.to.be.null;
    expect(data.notification.createdAt).not.to.be.null;
    expect(data.notification.type).to.equal(NotificationType.INVITATION);
    expect(data.notification.relatedObject).not.to.be.null;
    expect(data.notification.relatedObject?.inviteePublicKey).to.equal(user2Pk);
    expect(data.notification.relatedObject?.inviterPublicKey).to.equal(user1Pk);
    expect(data.notification.relatedObject?.itemPaths[0].bucket).to.equal('personal');
    expect(data.notification.relatedObject?.itemPaths[0].path).to.equal('/top.txt');
    expect(data.notification.relatedObject?.itemPaths[0].dbId).not.to.be.null;
    expect(data.notification.relatedObject?.itemPaths[0].bucketKey).not.to.be.null;
    expect(data.notification.relatedObject?.keys[0]).not.to.be.null;
  }).timeout(TestsDefaultTimeout);
});
