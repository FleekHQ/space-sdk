import { CollectionConfig } from '@textile/hub';
const MODEL_NAME = 'MirrorFile';

const schema = {
  title: MODEL_NAME,
  type: 'object',
  required: ['_id'],
  properties: {
    _id: {
      type: 'string',
      description: "The instance's id.",
    },
    path: {
      type: 'string',
    },
    bucket_slug: {
      type: 'string',
    },
    backup: {
      type: 'boolean',
    },
    shared: {
      type: 'boolean',
    },
    backupInProgress: {
      type: 'boolean',
    },
    restoreInProgress: {
      type: 'boolean',
    },
    DbID: {
      type: 'string',
    },
  },
};

class MirrorFile {
  public static getCollectionConfig(): CollectionConfig {
    return {
      name: MODEL_NAME,
      schema,
    };
  }
}

export default MirrorFile;
