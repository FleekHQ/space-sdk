# Space SDK

Space SDK is a browser ready implementation of the Space API, which packages IPFS, Textile, Filecoin and other decentralized technologies.

Space SDK is analogue to [Space Daemon](https://github.com/FleekHQ/space-daemon), but, while Space Daemon is made for building desktop apps, Space SDK is for web-based apps. The main difference between the two, apart from Space Daemon being built on Golang and Space SDK being built on JavaScript, is that Space Daemon embeds an IPFS node and caches files there, while Space SDK uses local storage only for metadata such as keys and Textile threads.

## Installation

### Browser

TODO: Package and release to NPM using the bundle made by `webpack`.

### Node

TODO: Package and release to NPM using the bundle made by `yarn build` (Pure Typescript).

## Usage

### Initialization

```javascript
const opts = const devOpts: SpaceAPIOpts = {
  hubMultiaddress: '...',
  hubUrl: '...',
  sessionDurationInMs: 1000 * 60 * 60 * 24,
  spaceServicesAuthUrl: '...',
  vaultSaltSecret: '...',
  vaultServiceUrl: '...',
};

const api = new SpaceAPI(opts);
```

Note: All options can be left blank and the connection will be defaulted to Textile Hub and Space Services.

### Methods

#### recoverKeysByPassphrase(uuid: string, passphrase: string)

Recovers a user key from the vault service and proceeds to log in to Textile Hub using said key. Will store the user session to local storage.

#### listDirectory(path: string, bucket: string)

Lists the contents of a directory for the given bucket. Requires the user to be logged in.

## Package Architecture

This package declares all API methods inside `src/api/index.ts`. It uses the class `SpaceService`, declared in `src/service/index.ts` which wraps the actual logic behind API calls. The module `src/auth` contains the logic behind retrieving API keys, logging into the Textile Hub, creating new keys (TODO), and anything else related to maintaining the user session.

# Auth

Auth works in two steps. First is recovering the user keys and second is using said keys to authorize towards Textile Hub.

For the first step, we use exactly the same cryptography than Space Daemon. You can read more about it [by clicking here](https://docs.fleek.co/space-daemon/crypto/).

For the second step, Space SDK connects through Web Sockets to a Space Service auth endpoint. It sends the user's public key, and gets a challenge back. The SDK signs the challenge using the user's private key, and submits the signed challenge back. The auth endpoint returns a JSON Web Token (JWT) if the signature matches the expected one. We use that JWT for all successive Textile calls.

### Textile threads

Every user owns a `Metathread`, which contains meta information about that user, such as the buckets they own. This metathread is shared between desktop and browser instances of the app, and is constantly synchronized.

After this `Metathread` is synchronized, all operations can be executed without hassle. For example, read operations, such as `listDirectory`, can query the `Metathread` for the list of buckets the user owns, and then do the following:

```
request: ListDirectory(/* rootDir by default */, "personal")

internal:
1. Get Metathread
2. Get dbID for bucket "personal_mirror"
3. Return contents by doing threadsClient.find(dbID, collections.Bucket.MODEL_NAME)
```

Given the last query points to the Mirror Bucket, it doesn't need to sync anything, it can simply return the mirror bucket current state as it lives on the hub.

For write operations, simply write to the mirror bucket thread directly. Space Daemon will be constantly listening for updates on that thread and synchronizing its local threads accordingly.