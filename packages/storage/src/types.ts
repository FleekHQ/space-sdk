export interface CreateFolderRequest {
  path: string;
  bucket: string;
}

export interface ListDirectoryRequest {
  path: string;
  bucket: string;
  /**
   * set recursive to true, if you would like all children of folder entries
   * to be recursively fetched.
   */
  recursive?: boolean;
}

/**
 * Represent an item stored in a storages directory
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  cid: string;
  isDir: boolean;
  size: number;
  items?: DirectoryEntry[];
}

export interface ListDirectoryResponse {
  items: DirectoryEntry[];
}
