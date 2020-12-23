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
}

export interface AddItemFile {
  /** path is path in the bucket where the file should be uploaded.
   * filename would be determined by the last segment in the path
   * so path folder/a_file.txt would have the name `a_file.txt`
   */
  path: string;
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
