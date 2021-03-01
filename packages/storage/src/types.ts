import { PathAccessRole } from '@textile/hub';

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
  role: PathAccessRole;
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
  created: string;
  updated: string;
  fileExtension: string;
  isLocallyAvailable: boolean;
  backupCount: number;
  members: FileMember[];
  isBackupInProgress: boolean;
  isRestoreInProgress: boolean;
  uuid: string;
  items?: DirectoryEntry[];
  bucket:string;
  dbId: string;
}

export interface ListDirectoryResponse {
  items: DirectoryEntry[];
}

export interface OpenFileRequest {
  path: string;
  bucket: string;
  /**
   * progress callback if provided will be called with bytes read from
   * remote while opening the file.
   *
   */
  progress?: (bytesRead?: number) => void;
}

export interface OpenUuidFileRequest {
  uuid: string;
  /**
   * progress callback if provided will be called with bytes read from
   * remote while opening the file.
   *
   */
  progress?: (bytesRead?: number) => void;
}

export interface MakeFilePublicRequest {
  path: string;
  bucket: string;
  /**
   * DbId where file is location, optional but required for instances where the file is a shared file.
   *
   */
  dbId?: string;
  /**
   * Specifies if public access to file should be accessible.
   *
   */
  allowAccess: boolean;
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

export interface OpenUuidFileResponse {
  stream: AsyncIterableIterator<Uint8Array>;
  /**
   * consumeStream aggregates the stream data and returns the compounded bytes array.
   *
   * Note that if the `stream` has already been consumed/used once, consumeStream would
   * return an empty bytes array.
   */
  consumeStream: () => Promise<Uint8Array>;
  mimeType: string | undefined;
  /**
   * Directory Entry representing the file this stream points to.
   *
   */
  entry: DirectoryEntry;
}

export type AddItemDataType = ReadableStream<Uint8Array> | ArrayBuffer | string | Blob;

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
  data: AddItemDataType;
  /**
   * progress callback if provided will be called with bytes written to
   * remote while uploading the file.
   *
   */
  progress?: (bytesRead?: number) => void;
}

export interface AddItemsRequest {
  bucket: string;
  files: AddItemFile[];
}

export interface AddItemsStatus {
  path: string;
  status: 'success' | 'error';
  /**
   * Directory entry of uploaded file.
   *
   * Only present if status is 'success'.
   *
   */
  entry?: DirectoryEntry;
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

/**
 * SharedWithMeFiles Represents a file created for the user
 *
 */
export interface SharedWithMeFiles {
  entry: DirectoryEntry;
  /**
   * sharedBy is the public key of the owner of the files
   *
   */
  sharedBy: string;
}

export interface GetFilesSharedWithMeResponse {
  files: SharedWithMeFiles[];
  nextOffset?: string;
}

export interface AcceptInvitationResponse {
  files: SharedWithMeFiles[];
}

export interface GetFilesSharedByMeResponse {
  files: SharedWithMeFiles[];
  nextOffset?: string;
}

export interface GetRecentlySharedWithResponse {
  members: FileMember[];
  nextOffset?: string;
}

export interface TxlSubscribeBucketEvent {
  bucketName: string;
  status: 'success' | 'error';
  error?: Error;
}

export type TxlSubscribeEventData = TxlSubscribeBucketEvent;
export type TxlSubscribeEventType = 'data' | 'error' | 'done';
export type TxlSubscribeListener = (data: TxlSubscribeEventData) => void;

export interface TxlSubscribeResponse {
  on: (type: TxlSubscribeEventType, listener: TxlSubscribeListener) => void;
  /**
   * this function should only be used to listen for the `'done'` event, since the listener would only be called once.
   * or else you could end up having functions leaking (unless you explicitly call the `off()` function).
   */
  once: (type: TxlSubscribeEventType, listener: TxlSubscribeListener) => void;
  off: (type: TxlSubscribeEventType, listener: TxlSubscribeListener) => void;
}

export interface NotificationSubscribeEvent {
  notification: Notification;
  status: 'success' | 'error';
  error?: Error;
}

export type NotificationSubscribeEventData = NotificationSubscribeEvent;
export type NotificationSubscribeEventType = 'data' | 'error' | 'done';
export type NotificationSubscribeListener = (data: NotificationSubscribeEventData) => void;

export interface NotificationSubscribeResponse {
  on: (type: NotificationSubscribeEventType, listener: NotificationSubscribeListener) => void;
  /**
   * this function should only be used to listen for the `'done'` event, since the listener would only be called once.
   * or else you could end up having functions leaking (unless you explicitly call the `off()` function).
   */
  once: (type: NotificationSubscribeEventType, listener: NotificationSubscribeListener) => void;
  off: (type: NotificationSubscribeEventType, listener: NotificationSubscribeListener) => void;
}

/**
 * FullPath represents full path information to a file.
 * `dbId` is optional and only required for when re-sharing files in another db.
 */
export interface FullPath {
  path: string;
  bucket: string;
  bucketKey?: string;
  dbId?: string;
  uuid?: string;
}

/**
 * InvitationStatus represents the different statuses a file invitation could have
 */
export enum InvitationStatus {
  PENDING = 0,
  ACCEPTED,
  REJECTED,
}

/**
 * Invitation represents a file invitation
 * `invitationID` is the same as the underlying message ID from Textile
 */
export interface Invitation {
  inviterPublicKey: string;
  inviteePublicKey: string;
  invitationID?: string;
  status: InvitationStatus;
  itemPaths: FullPath[];
  keys: string[];
}

/**
 * Data object to represent public key of a user to share information with
 *
 */
export interface SharePublicKeyInput {
  /**
   * A unique id provided by the client to identity this user.
   * For example, it can be the users username or email.
   *
   */
  id: string;
  /**
   * pk should be a multibase or hex encoded version of the public key to share.
   * It is also optional and can be left undefined. When undefined a temp key is generated
   * for the id.
   *
   */
  pk?: string;
}

export interface ShareViaPublicKeyRequest {
  /**
   * Hex encoded public keys of users to share the specified files with.
   *
   */
  publicKeys: SharePublicKeyInput[];
  paths: FullPath[];
}

export enum ShareKeyType {
  Temp = 'temp',
  Existing = 'existing',
}

/**
 * Data object to represent public key of a user to share information with
 *
 */
export interface SharePublicKeyOutput {
  /**
   * This is the same the same unique id provided by the client on the SharePublicKeyInput
   *
   */
  id: string;

  /**
   * Multibase base32 encoded public key of user.
   *
   */
  pk: string;

  /**
   * Type is an enum that is ShareKeyType.Temp or ShareKeyType.Existing
   *
   * 'temp' is when the input doesn't provide a valid 'pk'
   * 'existing' is when the input had a `pk` set.
   *
   * It's useful for the user of the sdk to determine what type of action to be performed.
   */
  type: ShareKeyType;

  /**
   * Temporary access key for temp key types. To be used by user to access the invite
   *
   */
  tempKey?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ShareViaPublicKeyResponse {
  publicKeys: SharePublicKeyOutput[];
}

export enum NotificationType {
  UNKNOWN = 0,
  INVITATION = 1,
  USAGEALERT = 2,
  INVITATION_REPLY = 3,
  REVOKED_INVITATION = 4,
}

export interface Notification {
  id: string;
  from: string;
  to: string;
  body: Uint8Array;
  decryptedBody: Uint8Array;
  type: NotificationType;
  createdAt: number;
  readAt?: number;
  relatedObject?: Invitation;
}

export interface GetNotificationsResponse {
  notifications: Notification[];
  nextOffset: string;
  lastSeenAt: number;
}
