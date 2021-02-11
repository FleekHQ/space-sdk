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
