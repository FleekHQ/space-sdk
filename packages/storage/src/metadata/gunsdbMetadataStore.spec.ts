import { Identity } from '@spacehq/users';
import { PrivateKey } from '@textile/crypto';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import { expect, use } from 'chai';
import { GunsdbMetadataStore } from './gunsdbMetadataStore';

use(chaiAsPromised.default);
use(chaiSubset.default);

const identity: Identity = PrivateKey.fromRandom();
describe('GunsdbMetadataStore', () => {
  it('should work', async () => {
    const bucket = 'personal';
    const dbId = 'something';
    const store = await GunsdbMetadataStore.fromIdentity(identity);

    // test create bucket data
    const newSchema = await store.createBucket(bucket, dbId);
    expect(newSchema).to.containSubset({ dbId, slug: bucket });

    // eslint-disable-next-line no-unused-expressions
    expect(newSchema.encryptionKey).to.not.be.empty;

    // test find bucket data
    const foundSchema = await store.findBucket(bucket, dbId);
    expect(foundSchema).to.containSubset({ dbId, slug: bucket });
    expect(Buffer.from(foundSchema?.encryptionKey || '').toString('hex')).to
      .equal(Buffer.from(newSchema.encryptionKey).toString('hex'));

    // ensure list bucket returns all value on fresh initialization
    const newStore = await GunsdbMetadataStore.fromIdentity(identity);

    const existingBuckets = await newStore.listBuckets();
    expect(existingBuckets).to.containSubset([{ dbId, slug: bucket }]);
  }).timeout(10000);
});
