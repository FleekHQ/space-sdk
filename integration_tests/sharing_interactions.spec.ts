/* eslint-disable no-unused-expressions */
import { AddItemsEventData,
  AddItemsResultSummary,
  UserStorage,
  ShareKeyType,
  Notification,
  NotificationType,
  NotificationSubscribeEventData,
  InvitationStatus,
  SpaceUser } from '@spacehq/sdk';
import { tryParsePublicKey } from '@spacehq/utils';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import { TestsDefaultTimeout, TestStorageConfig } from './fixtures/configs';
import { authenticateAnonymousUser } from './helpers/userHelper';

use(chaiAsPromised.default);
use(chaiSubset.default);

async function acceptNotification(inviteeStorage: UserStorage, notification: Notification, inviter: SpaceUser) {
  // accept the notification
  await inviteeStorage.handleFileInvitation(notification.id, true);

  // verify notification status is now accepted
  const updatedNotification = await inviteeStorage.getNotifications();
  expect(updatedNotification.notifications, 'updatedNotification').to.containSubset([{
    id: notification.id,
    relatedObject: {
      status: InvitationStatus.ACCEPTED,
    },
  }]);

  // verify get recently shared contains accepted file
  const recentlyAccepted = await inviteeStorage.getFilesSharedWithMe();
  expect(recentlyAccepted.files).not.to.be.empty;
  expect(recentlyAccepted.files[0], 'recentlyAcceptedFiles[0]').to.containSubset({
    sharedBy: Buffer.from(inviter.identity.public.pubKey).toString('hex'),
    entry: {
      name: 'top.txt',
      path: '/top.txt',
    },
  });
}

describe('Users sharing data', () => {
  it('users can share, accept and view shared files', async () => {
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

    // verify user1's recently shared with is updated
    const recentlySharedWith = await storage1.getRecentlySharedWith();
    expect(recentlySharedWith.members, 'recentlySharedwith.members').to.containSubset([{
      publicKey: user2.identity.public.toString(),
      // ... // verify address and role too
    }]);

    const ts = Date.now();
    await storage2.setNotificationsLastSeenAt(ts);

    // verify user2 get notification
    const received = await storage2.getNotifications();
    expect(received.notifications[0]).not.to.be.null;
    expect(received.notifications[0].from).to.equal(tryParsePublicKey(user1Pk).toString());
    expect(received.notifications[0].to).to.equal(tryParsePublicKey(user2Pk).toString());
    expect(received.notifications[0].id).not.to.be.null;
    expect(received.notifications[0].createdAt).not.to.be.null;
    expect(received.notifications[0].type).to.equal(NotificationType.INVITATION);
    expect(received.notifications[0].relatedObject).not.to.be.null;
    expect(received.notifications[0].relatedObject?.inviteePublicKey).to.equal(user2.identity.public.toString());
    expect(received.notifications[0].relatedObject?.inviterPublicKey).to.equal(user1Pk);
    expect(received.notifications[0].relatedObject?.itemPaths[0].bucket).to.equal('personal');
    expect(received.notifications[0].relatedObject?.itemPaths[0].path).to.equal('/top.txt');
    expect(received.notifications[0].relatedObject?.itemPaths[0].dbId).not.to.be.null;
    expect(received.notifications[0].relatedObject?.itemPaths[0].bucketKey).not.to.be.null;
    expect(received.notifications[0].relatedObject?.keys[0]).not.to.be.null;
    expect(received.lastSeenAt).to.equal(ts);

    // accept the notification
    await acceptNotification(storage2, received.notifications[0], user1);
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
    expect(data.notification.relatedObject?.inviteePublicKey).to.equal(user2.identity.public.toString());
    expect(data.notification.relatedObject?.inviterPublicKey).to.equal(user1Pk);
    expect(data.notification.relatedObject?.itemPaths[0].bucket).to.equal('personal');
    expect(data.notification.relatedObject?.itemPaths[0].path).to.equal('/top.txt');
    expect(data.notification.relatedObject?.itemPaths[0].dbId).not.to.be.null;
    expect(data.notification.relatedObject?.itemPaths[0].bucketKey).not.to.be.null;
    expect(data.notification.relatedObject?.keys[0]).not.to.be.null;
  }).timeout(TestsDefaultTimeout);

  it('sharing empty pk (temp key) should work', async () => {
    const { user: user1 } = await authenticateAnonymousUser();
    const user1Pk = Buffer.from(user1.identity.public.pubKey).toString('hex');
    const txtContent = 'Some manual text should be in the file';

    const storage1 = new UserStorage(user1, TestStorageConfig);
    await storage1.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'top.txt',
          data: txtContent,
          mimeType: 'plain/text',
        },
      ],
    });

    await storage1.initMailbox();

    // share with new user
    const shareResult = await storage1.shareViaPublicKey({
      publicKeys: [{
        id: 'new-space-user@fleek.co',
        pk: '',
      }],
      paths: [{
        bucket: 'personal',
        path: '/top.txt',
      }],
    });

    expect(shareResult.publicKeys).not.to.be.empty;
    expect(shareResult.publicKeys[0].type).to.equal(ShareKeyType.Temp);
    expect(shareResult.publicKeys[0].pk).not.to.be.empty;

    // authenticate new user to sync notifications
    const { user: user2 } = await authenticateAnonymousUser();
    const storage2 = new UserStorage(user2, { ...TestStorageConfig, debugMode: false });
    await storage2.syncFromTempKey(shareResult.publicKeys[0].tempKey || '');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // verify notification now contains invite to `top.txt`
    const received = await storage2.getNotifications();
    expect(received.notifications).to.containSubset([{
      relatedObject: {
        inviterPublicKey: Buffer.from(user1.identity.public.pubKey).toString('hex'),
        inviteePublicKey: user2.identity.public.toString(),
      },
      type: NotificationType.INVITATION,
    }]);

    await acceptNotification(storage2, received.notifications[0], user1);
  }).timeout(TestsDefaultTimeout);
});
