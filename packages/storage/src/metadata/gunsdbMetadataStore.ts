/* eslint-disable no-underscore-dangle */
import { isNode } from 'browser-or-node';
import { IGunChainReference } from 'gun/types/chain';
import { IGunStatic } from 'gun/types/static';
import { Identity } from '@spacehq/users';
import { BucketMetadata, UserMetadataStore } from './metadataStore';

let Gun: IGunStatic;
if (isNode) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
  Gun = require('gun');
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
  Gun = require('gun/gun');
  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
  require('gun/sea');
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto-browserify');

// this is an hack to enable using IGunChainReference in async functions
export type GunChainReference<Data> = Omit<IGunChainReference<Data>, 'then'>;

// 32 bytes aes key + 16 bytes salt/IV + 32 bytes HMAC key
const BucketEncryptionKeyLength = 32 + 16 + 32;
const BucketMetadataCollection = 'BucketMetadata';

interface AckError {
  err: string;
}

// Remapped bucket metadata type compatible with Gundb
type GunBucketMetadata = Omit<BucketMetadata, 'encryptionKey'> & { encryptionKey: string };
type EncryptedGunBucketMetadata = { data: string; };

interface LookupDataState {
  [dbIdBucket: string]: EncryptedGunBucketMetadata;
}

interface ListDataState {
  [collectionName: string]: EncryptedGunBucketMetadata[]
}

// Data schema of records stored in gundb
// currently only a single bucket metadata collection
export type GunDataState = LookupDataState | ListDataState;

/**
 * A Users Storage Metadata store backed by gundsdb.
 *
 * This is the default MetadataStore used by {@link @spacehq/sdk#UserStorage}.
 *
 */
export class GunsdbMetadataStore implements UserMetadataStore {
  private readonly gun: GunChainReference<GunDataState>;

  // in memory cache list of buckets
  private bucketsListCache: BucketMetadata[];

  private _user?: GunChainReference<GunDataState>;

  /**
   * Creates a new instance of this metadata store for users identity.
   *
   * @param identity - Identity of user owning this store
   * @param gunOrServer - initialized gun instance or peer server
   */
  private constructor(private readonly identity: Identity, gunOrServer?: GunChainReference<GunDataState> | string) {
    if (gunOrServer) {
      if (typeof gunOrServer === 'string') {
        this.gun = Gun({ web: gunOrServer });
      } else {
        this.gun = gunOrServer;
      }
    } else {
      this.gun = Gun();
    }

    this.bucketsListCache = [];
  }

  /**
   * Creates a new instance of this metadata store for users identity.
   *
   * @param identity - Identity of user owning this store
   * @param gunOrServer - initialized gun instance or peer server
   */
  static async fromIdentity(
    identity: Identity,
    gunOrServer?: GunChainReference<GunDataState> | string,
  ): Promise<GunsdbMetadataStore> {
    const store = new GunsdbMetadataStore(identity, gunOrServer);
    await store.authenticateUser();
    await store.startCachingBucketsList();

    return store;
  }

  /**
   * {@inheritDoc @spacehq/sdk#UserMetadataStore.createBucket}
   */
  public async createBucket(bucketSlug: string, dbId: string): Promise<BucketMetadata> {
    // throw if dbId with bucketSlug doesn't already
    const existingBucket = await this.findBucket(bucketSlug, dbId);
    if (existingBucket) {
      throw new Error('Bucket with slug and dbId already exists');
    }

    const schema: BucketMetadata = {
      dbId,
      encryptionKey: crypto.randomBytes(BucketEncryptionKeyLength),
      slug: bucketSlug,
    };
    const encryptedMetadata = await this.encryptBucketSchema(schema);
    const lookupKey = GunsdbMetadataStore.getBucketsLookupKey(bucketSlug, dbId);

    const nodeRef = this.lookupUser.get(lookupKey).put(encryptedMetadata);
    // store in list too. the unknown cast is required because of typescripts limitation
    // but it to ensure that the set has a reference to the actual data
    this.listUser.get(BucketMetadataCollection).set(nodeRef as unknown as EncryptedGunBucketMetadata);

    return schema;
  }

  /**
   * {@inheritDoc @spacehq/sdk#UserMetadataStore.findBucket}
   */
  public async findBucket(bucketSlug: string, dbId: string): Promise<BucketMetadata | undefined> {
    const lookupKey = GunsdbMetadataStore.getBucketsLookupKey(bucketSlug, dbId);
    const encryptedData = await new Promise<EncryptedGunBucketMetadata | undefined>((resolve, reject) => {
      this.lookupUser.get(lookupKey).once((data) => {
        resolve(data);
      });
    });
    // unregister lookup
    this.lookupUser.get(lookupKey).off();

    if (!encryptedData) {
      return undefined;
    }

    return this.decryptBucketSchema(encryptedData);
  }

  /**
   * {@inheritDoc @spacehq/sdk#UserMetadataStore.listBuckets}
   */
  public async listBuckets(): Promise<BucketMetadata[]> {
    return this.bucketsListCache;
  }

  private async startCachingBucketsList(): Promise<void> {
    this.listUser.get(BucketMetadataCollection).map().once(async (data) => {
      if (data) {
        try {
          const decryptedData = await this.decryptBucketSchema(data);
          this.bucketsListCache.push(decryptedData);
        } catch (err) {
          // an error occurred. most likely not our data
        }
      }
    });

    // wait a few seconds so results would start filling cache before returning
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  private static getBucketsLookupKey(bucketSlug: string, dbId: string): string {
    return `bucketSchema/${bucketSlug}/${dbId}`;
  }

  private get user(): GunChainReference<GunDataState> {
    if (!this._user || !(this._user as unknown as { is?: Record<never, never>; }).is) {
      throw new Error('gundb user not authenticated');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._user!;
  }

  // use this alias getter for lookuping up users metadata so typescript works as expected
  private get lookupUser(): GunChainReference<LookupDataState> {
    return this.user as GunChainReference<LookupDataState>;
  }

  // use this alias getter for listening to users metadata list so typescript works as expected
  private get listUser(): GunChainReference<ListDataState> {
    return this.user as GunChainReference<ListDataState>;
  }

  private async authenticateUser(): Promise<void> {
    // user.is checks if user is currently logged in
    if (this._user && (this._user as unknown as { is?: Record<never, never>; }).is) {
      return;
    }

    const username = this.publicKey;
    const password = this.privateKey;
    this._user = this.gun.user();

    await new Promise((resolve, reject) => {
      // eslint-disable-next-line no-unused-expressions
      this._user?.create(username, password, (ack) => {
        // if ((ack as AckError).err) {
        //   // error here means user either exists or is being created, see gundb user docs.
        //   // so ignoring
        //   return;
        // }

        // eslint-disable-next-line no-unused-expressions
        this._user?.auth(username, password, (auth) => {
          if ((auth as AckError).err) {
            reject(new Error(`gundb failed to authenticate user: ${(auth as AckError).err}`));
            return;
          }
          resolve();
        });
      });
    });
  }

  // encrypts data with users private key
  private async encrypt(data: string): Promise<string> {
    return Gun.SEA.encrypt(data, this.privateKey);
  }

  private async decrypt(data: string): Promise<Record<string, string> | undefined> {
    return ((Gun.SEA.decrypt(data, this.privateKey)) as Promise<Record<string, string> | undefined>);
  }

  private get privateKey(): string {
    return Buffer.from(this.identity.privKey).toString('hex');
  }

  private get publicKey(): string {
    return Buffer.from(this.identity.public.pubKey).toString('hex');
  }

  private async encryptBucketSchema(schema: BucketMetadata): Promise<EncryptedGunBucketMetadata> {
    return {
      data: await this.encrypt(JSON.stringify({
        ...schema,
        encryptionKey: Buffer.from(schema.encryptionKey).toString('hex'),
      })),
    };
  }

  private async decryptBucketSchema(encryptedSchema: EncryptedGunBucketMetadata): Promise<BucketMetadata> {
    const decryptedSchema = await this.decrypt(encryptedSchema.data);
    if (!decryptedSchema) {
      throw new Error('Unknown bucket metadata');
    }

    const gunschema: GunBucketMetadata = decryptedSchema as GunBucketMetadata;
    return {
      ...gunschema,
      encryptionKey: Buffer.from(gunschema.encryptionKey, 'hex'),
    };
  }
}
