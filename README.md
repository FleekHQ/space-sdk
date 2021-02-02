![](https://fleek-team-bucket.storage.fleek.co/Blog%20Inline/sdk.png)

# Space SDK
[![Fleek](https://img.shields.io/badge/Made%20by-Fleek-blue)](https://fleek.co/)
[![Dev Slack](https://img.shields.io/badge/Dev%20Slack-Channel-blue)](https://slack.fleek.co/)
[![License](https://img.shields.io/badge/License-MIT-green)](https://github.com/FleekHQ/space-sdk/blob/master/LICENSE)


 Javascript/Typescript library for interacting with Space in web/browser  applications via an implementation of the Space API. Build websites or applications that can easily leverage Open Web protocols (IPFS, Textile, GunDB, Ethereum) to enable Web3-ready features like:

 - File and directory storage / retrieval in user-controlled, encrypted, and distributed storage.
 - Key-pair based identity management and challenge-based authentication.
 - Decentralized and secure key and bucket metadata storage.
 - Private and end-to-end encrypted, or public file sharing.

 The Space SDK is  a close friend of the [Space Daemon](https://github.com/FleekHQ/space-daemon/), its desktop-focused counterpart. 

 **You can find the SDK's documentation here:**
* [Space SDK Documentation](https://fleekhq.github.io/space-sdk/docs/)
* [Entire Space SDK package breakdown](https://fleekhq.github.io/space-sdk/docs/sdk)



### Default Implementations
The Space SDK is modular and protocol agnostic. You can use the APIs and interfaces as is, with Space's default implementations, or replace them with your own custom ones.
|Feature   	|Description  	| Service/Protocol
|-:	|-	|-	|
| Users 	|  Key-pair based identity creation, and challenge authentication.	| Textile Users API
| Storage 	|  File, directory, and bucket creation/listing.	| IPFS / Textile 
| Metadata 	|  Secure Bucket/directory schema storage	| GunDB
| Sharing 	|  **Coming soon!**	| Textile |

----
 
## Introduction
`@spacehq/sdk` provides a suit of functionality to perform different action on Space.

## Installation
Install the sdk using this npm command:
```
npm install @spacehq/sdk
```

## Usage
Space SDK provides an interface perform the following actions:

- Creating identities

- Create files and directories

- List files and directories

- Creating buckets

- Sharing buckets

Full SDK Documentation with examples can be found [here](https://fleekhq.github.io/space-sdk/)

### 1. Identities
This involves managing users and their identities.

```typescript
import { Users } from '@spacehq/sdk';

const users = new Users({ endpoint: 'wss://auth-dev.space.storage' });

// createIdentity generate a random keypair identity
const identity = await users.createIdentity();

// the new keypair can be used to authenticate a new user
// `users.authenticate()` generates hub API session tokens for the keypair identity.
const user = await users.authenticate(identity);
// `user` can be used with the storage class to provide identity.

// user's identity can also be backed up with a special recovery phrase
const uuid = 'specify-uuid-representing-user-in-your-system';
const passphrase = 'specify-unique-pass-phrase-related-to-backup-type';
const backupType = VaultBackupType.Google;
await users.backupKeysByPassphrase(uuid, passphrase, backupType, user.identity);

// backed up users identity can also be recovered later
const recoveredUser = await users.recoverKeysByPassphrase(uuid, passphrase, backupType);
// `recoveredUser` has same authentication as `user` above.
```

Check the [User's](https://fleekhq.github.io/space-sdk/docs/sdk.users) class for more examples of how to manage users
with the sdk. 

### 2. Storage
This involves operations to create and list files and directories in space storage.

```typescript
import { UserStorage, AddItemsResultSummary } from '@spacehq/sdk';

const storage = new UserStorage(user);
await storage.createFolder({ bucket: 'personal', path: 'topFolder' });
const result = await storage.listDirectory({ path: '' });
// result contains `topFolder` items

// upload a file
const uploadResponse = await spaceStorage.addItems({
   bucket: 'personal',
   files: [
     {
       path: 'file.txt',
       content: '',
     },
     {
       path: 'space.png',
       content: '',
     }
   ],
});
// uploadresponse is an event listener
uploadResponse.once('done', (data: AddItemsEventData) => {
  const summary = data as AddItemsResultSummary;
  // returns a summary of all files and their upload status
});
```

### 3. Sharing
This includes operations to share your storage items with existing user (identites)  

```typescript
// WIP - Coming soon!
```

## Migrating from Space Daemon
If you are already familiar with the space daemon and its gRPC methods and would like to start using the space-sdk
here are some pointers on how those gRPC methods correspond to functionalities exposed by the space-sdk.

### Key Pairs (GenerateKeyPair)
In the sdk the concept of Key Pairs is represented as an [`Identity`](https://fleekhq.github.io/space-sdk/docs/sdk.identity).
To create a new Identity similar to the `GenerateKeyPair` method, you would do:

```typescript
import { Users, BrowserStorage } from '@spacehq/sdk';

const users = new Users({ endpoint: 'wss://auth-dev.space.storage' });

// createIdentity generate a random keypair identity
const identity = await users.createIdentity();
```
`identity` represents a keypair and its primary key is accessible via `identity.public.toString()`.

### Managing authenticated users

In space-daemon the generated keypair is stored in the operating systems keychain but in space-sdk you would
need to provide an [IdentityStorage](https://fleekhq.github.io/space-sdk/docs/sdk.identitystorage) to the `Users` class when initializing it.
For the browser environment there exists a [`BrowserStorage`](https://fleekhq.github.io/space-sdk/docs/sdk.browserstorage) implementation
you can use.

```typescript
import { Users, BrowserStorage } from '@spacehq/sdk';

const users = await Users.withStorage(
    new BrowserStorage(), 
    { endpoint: 'wss://auth-dev.space.storage' }
);
```

`Users.withStorage` will load and authenticate all identities that exist inside the provided `IdentityStorage`.
You can access all authenticated users through the [`Users.list`](https://fleekhq.github.io/space-sdk/docs/sdk.users.list) method.

```typescript
const spaceUsers = await users.list();
```

To authenticate a new user identity and get a [SpaceUser](https://fleekhq.github.io/space-sdk/docs/sdk.spaceuser), 
you can call the [`Users.authenticate`](https://fleekhq.github.io/space-sdk/docs/sdk.users.authenticate) method:

```typescript
const spaceUser = await users.authenticate(identity);
```

`Users.authentication` would do two things:
- Generate a [`SpaceUser`](https://fleekhq.github.io/space-sdk/docs/sdk.spaceuser). 
- Stores the new users information in the `IdentityStorage`, so subsequent initialization of `Users.withStorage()` would 
  have the users loaded.
  
NOTE: An existing space user can also be gotten from [`Users.recoverKeysByPassphrase`](https://fleekhq.github.io/space-sdk/docs/sdk.users.recoverkeysbypassphrase).  

To delete a user from users lists, you can delete the user by pass the `publicKey` of that user to [`Users.remove`](https://fleekhq.github.io/space-sdk/docs/sdk.users.remove).

```typescript
await users.remove(spaceUser.identity.public.toString());
```

#### Managing current active user
If you have the concept of a current active user in your application that uses space-sdk. We recommend that you keep track
of that users public key in your application and use it to filter the [list](https://fleekhq.github.io/space-sdk/docs/sdk.users.list) 
method's result to get the authenticated `SpaceUser` for that public key. 

On logout, you can call the [remove](https://fleekhq.github.io/space-sdk/docs/sdk.users.remove) method to stop tracking the user.

### GetAPISessionToken
In space daemon GetAPISessionToken returns the message:

```
message GetAPISessionTokensResponse {
  string hubToken = 1;
  string servicesToken = 2;
}
```

In order to get the `servicesToken` and `hubToken` for a particular user, you would need to authenticate that user identity:
```typescript
const spaceUser = await users.authenticate(identity);
```
The `spaceUser.token` value is the `servicesToken`, while the `spaceUser.storageAuth.token` is the `hubToken`.

Also, note that when an existing user is recovered via the [`Users.recoverKeysByPassphrase`](https://fleekhq.github.io/space-sdk/docs/sdk.users.recoverkeysbypassphrase) 
method, the `SpaceUser` returns is also authenticated and has the session tokens.

### GetPublicKey
In space daemon `GetPublicKey` returned the id of the current keypair in keychain, but since space-sdk returns the `identity`
object. You can get the public key bytes for a particular identity through `identity.public.pubKey`.

Also, an authenticated [`SpaceUser`](https://fleekhq.github.io/space-sdk/docs/sdk.spaceuser) identity can be found in the `identity` field.

### Storage Methods (createFolder, listDirectory, openFile, addItems)
The storage gRPC methods on space daemon can now be performed using the [`UserStorage`](https://fleekhq.github.io/space-sdk/docs/sdk.userstorage) class of the space-sdk.

```typescript
import { UserStorage, AddItemsResultSummary } from '@spacehq/sdk';

const storage = new UserStorage(user);
await storage.createFolder({ bucket: 'personal', path: 'topFolder' });
const result = await storage.listDirectory({ path: '' });
// result contains `topFolder` items

// upload a file
const uploadResponse = await spaceStorage.addItems({
   bucket: 'personal',
   files: [
     {
       path: 'file.txt',
       content: 'plain-text-value',
     },
     {
       path: 'space.png',
       content: '', // could also be a ReadableStream<Uint8Array> or ArrayBuffer
     }
   ],
});
// uploadresponse is an event listener
uploadResponse.once('done', (data: AddItemsEventData) => {
  const summary = data as AddItemsResultSummary;
  // returns a summary of all files and their upload status
});

// read content of an uploaded file
const fileResponse = await storage.openFile({ bucket: 'personal', path: '/file.txt'});
const fileContent = await fileResponse.consumeStream();
// new TextDecoder('utf8').decode(actualTxtContent) == 'plain-text-value'
```


## Contributing

All contributions are welcome. Before getting started, kindly take some time to review our [contributing guidelines](./CONTRIBUTING.md) 
and [code of conduct](./CODE_OF_CONDUCT.md).

## LICENSE
[MIT](./LICENSE)
