export interface CreateFolderRequest {
  /**
   * Storage bucket to create the empty folder
   */
  path: string;
  /**
   * Path in the bucket to create the empty folder
   */
  bucket: string;
}

export interface ListDirectoryRequest {
  /**
   * Path in the bucket to fetch directories from
   */
  path: string;
  /**
   * Storage bucket to fetch directory entries
   */
  bucket: string;
  /**
   * set recursive to true, if you would like all children of folder entries
   * to be recursively fetched.
   */
  recursive?: boolean;
}

/**
 * Represents a member on a shared file
 */
export interface FileMember {
  publicKey:string;
  address?:string;
}

/**
 * Represents an item stored in a storages directory
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  ipfsHash: string;
  isDir: boolean;
  sizeInBytes: number;
  created: Date;
  updated: Date;
  fileExtension: string;
  isLocallyAvailable: boolean;
  backupCount: number;
  members: FileMember[];
  isBackupInProgress: boolean;
  isRestoreInProgress: boolean;
  items?: DirectoryEntry[];
}

export interface ListDirectoryResponse {
  items: DirectoryEntry[];
}

export interface OpenFileRequest {
  path: string;
  bucket: string;
}

export interface OpenFileResponse {
  stream: AsyncIterableIterator<Uint8Array>;
  /**
   * consumeStream aggregates the stream data and returns the compounded bytes array.
   *
   * Note that if the `stream` has already been consumed/used once, consumeStream would
   * return an empty bytes array.
   */
  consumeStream: () => Promise<Uint8Array>;
  mimeType: string | undefined;
}

export interface AddItemFile {
  /**
   * path in the bucket where the file should be uploaded.
   * filename would be determined by the last segment in the path
   * so path folder/a_file.txt would have the name `a_file.txt`
   *
   */
  path: string;
  /**
   * MimeType of the file being added.
   * This value can be retrieved when opening the file later one.
   *
   */
  mimeType: string;
  data: ReadableStream<Uint8Array> | ArrayBuffer | string;
}

export interface AddItemsRequest {
  bucket: string;
  files: AddItemFile[];
}

export interface AddItemsStatus {
  path: string;
  status: 'success' | 'error';
  error?: Error;
}

export interface AddItemsResultSummary {
  bucket: string;
  files: AddItemsStatus[];
}

export type AddItemsEventData = AddItemsStatus | AddItemsResultSummary;
export type AddItemsEventType = 'data' | 'error' | 'done';
export type AddItemsListener = (data: AddItemsEventData) => void;

export interface AddItemsResponse {
  on: (type: AddItemsEventType, listener: AddItemsListener) => void;
  /**
   * this function should only be used to listen for the `'done'` event, since the listener would only be called once.
   * or else you could end up having functions leaking (unless you explicitly call the `off()` function).
   */
  once: (type: AddItemsEventType, listener: AddItemsListener) => void;
  off: (type: AddItemsEventType, listener: AddItemsListener) => void;
}
