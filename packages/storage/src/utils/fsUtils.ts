import path from 'path';

const metaFileNames = new Map();
metaFileNames.set('.textileseed', true);
metaFileNames.set('.textile', true);
metaFileNames.set('.DS_Store', true);
metaFileNames.set('.Trashes', true);
metaFileNames.set('.localized', true);

/**
 * Checks if this is a built in file that could
 * be ignored when returning results to a client
 *
 * @param pathOrName The name of the path or file
 */
export const isMetaFileName = (pathOrName: string): boolean => {
  const name = path.basename(pathOrName);

  return metaFileNames.get(name) || false;
};
