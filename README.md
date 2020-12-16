# Space SDK
 Javascript/Typescript library for interacting with Space in the browser.
 
## Introduction
`@space/sdk` provides a suit of functionality to perform different action on Space.

## Installation
Install the sdk using this npm command:
```
npm install @space/sdk
```

## Usage
Space SDK provides an interface perform the following actions:
 

- Creating identities

- Create files and directories

- List files and directories

- Creating buckets

- Sharing buckets

Full SDK Documentation can be [here](https://fleekhq.github.io/space-sdk/)

### 1. Identities
This involves managing users and their identities.

```typescript
import { Users } from '@space/sdk';


const users = new Users({ endpoint: 'https://identity-service-endpoint.com' });
const identity = await users.createIdentity();
const user = await users.authenticate(identity);

// TODO: Complete Code Snippet
```

### 2. Storage
This involves CRUD operations on your files and directories.

```typescript
import { UserStorage } from '@space/sdk';

const storage = new UserStorage(user);
await storage.createFolder({ bucket: 'personal', path: 'topFolder' });
await storage.listDirectory({ path: '' });

// TODO: Complete Code Snippet
```

### 3. Sharing
This includes operations to share your storage items with existing user (identites)  

```typescript
// to be determined
```

## LICENSE
MIT
