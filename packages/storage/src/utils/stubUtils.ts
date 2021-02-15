// This file should be deleted soon
// Its purpose it to temporarily provide stub data for some implementation before
// the actual logic is shipped

import dayjs from 'dayjs';
import { v4 } from 'uuid';
import { DirectoryEntry } from '../types';

export const getStubFileEntry = (filename = 'sample.txt'): DirectoryEntry => ({
  name: filename,
  isDir: false,
  path: `/mock/path/${filename}`,
  ipfsHash: '',
  sizeInBytes: 300,
  created: dayjs().format(),
  updated: dayjs().format(),
  fileExtension: filename.indexOf('.') >= 0 ? filename.substr(filename.lastIndexOf('.') + 1) : '',
  isLocallyAvailable: false,
  backupCount: 1,
  members: [],
  isBackupInProgress: false,
  isRestoreInProgress: false,
  uuid: v4(),
  items: [],
  bucket: 'personal',
  dbId: v4(),
});
