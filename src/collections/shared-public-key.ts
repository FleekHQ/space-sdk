import { CollectionConfig } from '@textile/hub';
const MODEL_NAME = 'SharedPublicKey';

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
    public_key: {
      type: 'string',
    },
    updated_at: {
      type: 'number',
    },
    created_at: {
      type: 'number',
    },
  },
};

class SharedPublicKey {
  public static getCollectionConfig(): CollectionConfig {
    return {
      name: MODEL_NAME,
      schema,
    };
  }
}

export default SharedPublicKey;
