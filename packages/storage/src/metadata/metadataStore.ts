/**
 * Metadata Store manages storing and retrieval of a particular users bucket schema information.
 *
 */
export interface UserMetadataStore {
  /**
   * Create a BucketSchema record with dbId belonging to the current user.
   *
   * It should fail if a bucketSlug with similar dbId already exists.
   *
   * @param bucketSlug - unqiue slug representing bucket provided by user.
   * @param dbId - unique id representing bucket thread provided by user storage.
   * @param bucketKey -  unique id representing bucket provided by user storage.
   */
  createBucket: (bucketSlug: string, dbId: string, bucketKey: string) => Promise<BucketMetadata>;

  /**
   * Find bucket metadata with slug belonging to the current user matching
   *
   */
  findBucket: (bucketSlug: string) => Promise<BucketMetadata | undefined>;

  /**
   * Returns a list of all bucket schemas belonging to the current user
   *
   */
  listBuckets: () => Promise<BucketMetadata[]>;

  /**
   * Updates the metadata information about a specific file.
   *
   */
  upsertFileMetadata: (data: FileMetadata) => Promise<FileMetadata>;

  /**
   * Find existing metadata information about the file at path.
   *
   */
  findFileMetadata: (
    bucketSlug:string,
    dbId: string,
    path: string,
  ) => Promise<FileMetadata | undefined>;

  /**
   * Find existing metadata information about the file with uuid
   *
   */
  findFileMetadataByUuid: (
    uuid: string,
  ) => Promise<FileMetadata | undefined>;

  /**
   * Make the file with uuid publicly accessible by storing in a datastore domain that is public.
   *
   */
  setFilePublic: (
    metadata: FileMetadata
  ) => Promise<void>;

  /**
   * Inserts a new shared with me file. If a file with the same
   * dbId, path and bucket slug exists, the existing record would be updated and returned.
   *
   */
  upsertSharedWithMeFile: (data: SharedFileMetadata) => Promise<SharedFileMetadata>;

  /**
   * List all shared with me files for the existing user
   *
   */
  listSharedWithMeFiles: () => Promise<SharedFileMetadata[]>;

  /**
   * Inserts a new file. If a file with the same
   * dbId, path and bucket slug exists, the existing record would be updated and returned.
   *
   */
  upsertSharedByMeFile: (data: SharedFileMetadata) => Promise<SharedFileMetadata>;

  /**
   * Lookup a received shared file by invitation id.
   *
   */
  findSharedFilesByInvitation: (invitationId: string) => Promise<SharedFileMetadata | undefined>;

  /**
   * List all shared files current user has shared with other users.
   *
   */
  listSharedByMeFiles(): Promise<SharedFileMetadata[]>;

  /**
   * Add user to set of users current user has recently shared files with.
   *
   */
  addUserRecentlySharedWith(user: ShareUserMetadata): Promise<ShareUserMetadata>;

  /**
   * List set of users the current user has recently shared files with
   *
   */
  listUsersRecentlySharedWith(): Promise<ShareUserMetadata[]>;
}

/**
 * This is equivalent to the BucketSchema struct of the space-daemon.
 * It contains information about a users bucket schema.
 *
 */
export interface BucketMetadata {
  /**
   * unique id that Textile uses internally for buckets
   */
  bucketKey: string;
  /**
   * unique user specified bucket slug
   */
  slug: string;
  /**
   * An 80 bytes encryption key used to encrypt and decrypt buckets storage content.
   *
   * 32 bytes aes key + 16 bytes salt/IV + 32 bytes HMAC key
   */
  encryptionKey: Uint8Array;
  /**
   * Unique dbId provided by the user storage
   */
  dbId: string;

  // Ignoring mirror files schema for now, but can be added later when backup is being implemented
}

/**
 * Represents metadata information about a file stored in users storage
 *
 */
export interface FileMetadata {
  uuid?: string;
  mimeType?: string;
  bucketKey?: string;
  bucketSlug: string;
  dbId: string;
  path: string;
}

/**
 * Represents files that were shared with the current store user
 *
 */
export interface SharedFileMetadata extends FileMetadata {
  /**
   * public key of sharer
   *
   */
  sharedBy: string;
  /**
   * Specifies if a shared file is accepted or rejected.
   *
   * Note: accepted can also be undefined, in situation where it is not required.
   */
  accepted?: boolean;
  /**
   * Invitation Id
   *
   */
  invitationId?: string;
}

export interface ShareUserMetadata {
  publicKey: string;
  role: number;
}
