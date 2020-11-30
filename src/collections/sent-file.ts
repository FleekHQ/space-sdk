import { CollectionConfig } from '@textile/hub';
const MODEL_NAME = 'SentFile';

const schema = {
  title: MODEL_NAME,
  type: 'object',
  required: ['_id'],
  properties: {
    _id: {
      type: 'string',
      description: "The instance's id.",
    },
    DbID: {
      type: 'string',
    },
    bucket: {
      type: 'string',
    },
    path: {
      type: 'string',
    },
    invitationId: {
      type: 'string',
    },
    bucketKey: {
      type: 'string',
    },
    encryptionKey: {
      type: 'buffer',
    },
  },
};

class SentFile {
  public static getCollectionConfig(): CollectionConfig {
    return {
      name: MODEL_NAME,
      schema,
    };
  }
}

export default SentFile;
