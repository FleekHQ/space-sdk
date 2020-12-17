import { SpaceUser } from '@space/users';
import { Buckets, PathItem, UserAuth } from '@textile/hub';
import { CreateFolderRequest, ListDirectoryRequest, ListDirectoryResponse } from './types';
import { sanitizePath } from './utils/pathUtils';

export const UserStorageErrors = {
  Unauthenticated: new Error('Provided user is not authenticated'),
};

interface UserStorageConfig {
  textileHubAddress?: string;
  /**
   * Optional initializer of a bucket from textiles users auth
   * can be use to override/provide custom initialization logic
   *
   * The default value will be Textiles Buckets.withUserAuth
   * @param auth
   */
  bucketsInit?: (auth: UserAuth) => Buckets;
}

// TODO: Change this to prod value
const DefaultTextileHubAddress = 'http://textile-hub-dev.fleek.co:3007';

/**
 * UserStorage performs storage actions on behalf of the user provided.
 *
 * @example
 * ```typescript
 * const spaceStorage = new UserStorage(spaceUser);
 *
 * // create an empty folder
 * await spaceStorage.createFolder({
 *   bucket: 'personal',
 *   path: '/cool'
 * });
 * ```
 */
export class UserStorage {
  constructor(private readonly user: SpaceUser, private readonly config: UserStorageConfig = {}) {
    this.config.textileHubAddress = this.config.textileHubAddress ?? DefaultTextileHubAddress;
  }

  /**
   * Creates an empty folder at the requested path and bucket.
   * @param request.bucket Storage bucket to create the empty folder
   * @param request.path Path in the bucket to create the empty folder
   * @remarks
   * - It throws if an error occurred while creating the folder
   */
  public async createFolder(request: CreateFolderRequest): Promise<void> {
    const client = this.getUserBucketsClient();

    const bucket = await client.getOrCreate(request.bucket);
    const file = {
      path: `${sanitizePath(request.path.trimStart())}/.keep`,
      content: Buffer.from(''),
    };

    await client.pushPath(bucket.root?.key || '', '.keep', file);
  }

  /**
   * Returns all bucket entries at the specified path.
   *
   * @param request.bucket Storage bucket to fetch directory entries
   * @param request.path Path in the bucket to fetch directories from
   * @param request.recursive Optional, if specified, it would recursively try and fetch all child entries of folders.
   */
  public async listDirectory(request: ListDirectoryRequest): Promise<ListDirectoryResponse> {
    const client = this.getUserBucketsClient();
    const bucket = await client.getOrCreate(request.bucket);

    const depth = request.recursive ? Number.MAX_SAFE_INTEGER : 1;
    const result = await client.listPath(bucket.root?.key || '', sanitizePath(request.path), depth);

    return {
      items: result.item?.items?.map((it: PathItem) => ({ ...it, entries: it.items })) || [],
    };
  }

  private getUserBucketsClient(): Buckets {
    return this.initBucket(this.getUserAuth());
  }

  private getUserAuth(): UserAuth {
    if (this.user.storageAuth === undefined) {
      throw UserStorageErrors.Unauthenticated;
    }

    return this.user.storageAuth;
  }

  private initBucket(userAuth: UserAuth): Buckets {
    if (this.config?.bucketsInit) {
      return this.config.bucketsInit(userAuth);
    }

    return Buckets.withUserAuth(userAuth, { host: this.config?.textileHubAddress });
  }
}
