import { CollectionConfig } from '@textile/hub';
const MODEL_NAME = 'ReceivedFile';

const schema = {
  title: MODEL_NAME,
  type: 'object',
  required: ['_id'],
  properties: {
    _id: {
      type: 'string',
      description: "The instance's id.",
    },
    accepted: {
      type: 'boolean',
    },
    created_at: {
      type: 'number',
    },
  },
};

class ReceivedFile {
  public static getCollectionConfig(): CollectionConfig {
    return {
      name: MODEL_NAME,
      schema,
    };
  }
}

export default ReceivedFile;
