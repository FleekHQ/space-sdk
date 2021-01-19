import { Identity } from '@spacehq/users';
import { isBrowser } from 'browser-or-node';
import { PrivateKey } from '@textile/crypto';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import { expect, use } from 'chai';
import { v4 } from 'uuid';
import { GundbMetadataStore } from './gundbMetadataStore';

use(chaiAsPromised.default);
use(chaiSubset.default);

const identity: Identity = PrivateKey.fromRandom();
const username = Buffer.from(identity.public.pubKey).toString('hex');
const password = Buffer.from(identity.privKey).toString('hex');
describe('GunsdbMetadataStore', () => {
  if (!isBrowser) {
    // TODO: Fix this for node. It fails because node isn't properly authenticating public account with server
    return;
  }

  it('should work', async () => {
    const bucket = 'personal';
    const dbId = 'something';
    const store = await GundbMetadataStore.fromIdentity(username, password);

    // test create bucket data
    const newSchema = await store.createBucket(bucket, dbId);
    expect(newSchema).to.containSubset({ dbId, slug: bucket });

    // eslint-disable-next-line no-unused-expressions
    expect(newSchema.encryptionKey).to.not.be.empty;

    // test find bucket data
    const foundSchema = await store.findBucket(bucket);
    expect(foundSchema).to.containSubset({ dbId, slug: bucket });
    expect(Buffer.from(foundSchema?.encryptionKey || '').toString('hex')).to
      .equal(Buffer.from(newSchema.encryptionKey).toString('hex'));

    // ensure list bucket returns all value on fresh initialization
    const newStore = await GundbMetadataStore.fromIdentity(username, password);

    const existingBuckets = await newStore.listBuckets();
    expect(existingBuckets).to.containSubset([{ dbId, slug: bucket }]);
  }).timeout(90000);

  it('should work for file metadata', async () => {
    const bucketSlug = 'personal';
    const dbId = 'something';
    const path = '/home/case.png';
    const store = await GundbMetadataStore.fromIdentity(username, password);
    const fileMetadata = {
      uuid: v4(),
      mimeType: 'image/png',
      bucketSlug,
      dbId,
      path,
    };

    await store.upsertFileMetadata(fileMetadata);

    const savedMetadata = await store.findFileMetadata(bucketSlug, dbId, path);
    expect(savedMetadata).to.deep.equal(fileMetadata);

    // test retrieving by uuid
    const savedMetadataByUuid = await store.findFileMetadataByUuid(fileMetadata.uuid);
    expect(savedMetadataByUuid).to.deep.equal(fileMetadata);
  }).timeout(90000);

  it('should fetch public file metadata correctly', async () => {
    const store = await GundbMetadataStore.fromIdentity(username, password, undefined, false);
    const fileMetadata = {
      uuid: v4(),
      mimeType: 'image/png',
      bucketSlug: 'personal',
      dbId: 'something',
      path: '/home/case.png',
    };

    await store.upsertFileMetadata(fileMetadata);
    await store.setFilePublic(fileMetadata);

    // test retrieving by uuid from another user
    const newUser: Identity = PrivateKey.fromRandom();
    const newStore = await GundbMetadataStore.fromIdentity(
      Buffer.from(newUser.public.pubKey).toString('hex'),
      Buffer.from(newUser.privKey).toString('hex'),
      undefined,
      false,
    );
    const savedMetadataByUuid = await newStore.findFileMetadataByUuid(fileMetadata.uuid);
    expect(savedMetadataByUuid).to.deep.equal(fileMetadata);
  }).timeout(90000);
});
