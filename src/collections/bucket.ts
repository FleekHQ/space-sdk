import { CollectionConfig } from '@textile/hub';
const MODEL_NAME = 'BucketMetadata';

const schema = {
  title: MODEL_NAME,
  type: 'object',
  required: ['_id'],
  properties: {
    _id: {
      type: 'string',
      description: "The instance's id.",
    },
    slug: {
      type: 'string',
    },
    backup: {
      type: 'boolean',
    },
    encryptionKey: {
      type: 'Buffer',
    },
    DbID: {
      type: 'string',
    },
    remoteDbId: {
      type: 'string',
    },
    remoteBucketKey: {
      type: 'string',
    },
    HubAddr: {
      type: 'string',
    },
    remoteBucketSlug: {
      type: 'string',
    },
  },
};

class Bucket {
  public static getCollectionConfig(): CollectionConfig {
    return {
      name: MODEL_NAME,
      schema,
    };
  }
}

export default Bucket;
