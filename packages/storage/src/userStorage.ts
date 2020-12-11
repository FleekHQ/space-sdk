import { SpaceUser } from '@space/users';
import { Buckets, UserAuth } from '@textile/hub';
import { CreateFolderRequest } from './types';
import { sanitizePath } from './utils/pathUtils';

export const UserStorageErrors = {
  Unauthenticated: new Error('Provided user is not authenticated'),
};

interface UserStorageConfig {
  hubMultiAddress?: string;
  /**
   * Optional initializer of a bucket from textiles users auth
   * can be use to override/provide custom initialization logic
   *
   * The default value will be Textiles Buckets.withUserAuth
   * @param auth
   */
  bucketsInit?: (auth: UserAuth) => Buckets;
}

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
  constructor(private readonly user: SpaceUser, private readonly config?: UserStorageConfig) {}

  /**
   * Creates an empty folder at the requested path and bucket.
   * @param request.bucket Storage bucket to create the empty folder
   * @param request.path Path in the bucket to create the empty folder
   * @remarks
   * - It throws if an error occurred while creating the folder
   */
  public async createFolder(request: CreateFolderRequest): Promise<void> {
    const buckets = this.initBucket(this.getUserAuth());

    const usersBucket = await buckets.getOrCreate(request.bucket);
    const file = {
      path: `${sanitizePath(request.path.trimStart())}/.keep`,
      content: Buffer.from(''),
    };

    await buckets.pushPath(usersBucket.root?.key || '', '.keep', file);
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
    return Buckets.withUserAuth(userAuth);
  }
}
