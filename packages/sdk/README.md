# Space SDK
 Javascript/Typescript library for interacting with Space in the browser.
 
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

Full SDK Documentation can be [here](https://fleekhq.github.io/space-sdk/)

### 1. Identities
This involves managing users and their identities.

```typescript
import { Users } from '@spacehq/sdk';

const users = new Users({ endpoint: 'https://identity-service-endpoint.com' });
const identity = await users.createIdentity();
const user = await users.authenticate(identity);
// `user` can be used with the storage class to provide identity.
```

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
// WIP
```
