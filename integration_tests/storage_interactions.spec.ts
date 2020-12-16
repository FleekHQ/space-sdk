import { UserStorage } from '@space/sdk';
import { TestsDefaultTimeout } from './fixtures/configs';
import { authenticateAnonymousUser } from './helpers/userHelper';

describe('Users storing data', () => {
  it('user should create an empty folder successfully', async () => {
    const { user } = await authenticateAnonymousUser();

    const storage = new UserStorage(user);
    // await storage.createFolder({ bucket: 'personal', path: 'topFolder' });

    // TODO: Verify folder is created with storage.listDirectory() when implemented
  }).timeout(TestsDefaultTimeout);
});
