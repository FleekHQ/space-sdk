import { Identity, SpaceUser, Users } from '@spacehq/sdk';
import { TestUsersConfig } from '../fixtures/configs';

export const authenticateAnonymousUser = async (
  usersSdk?: Users,
): Promise<{ user: SpaceUser; identity: Identity; users: Users }> => {
  const users = usersSdk || new Users(TestUsersConfig);
  const identity = await users.createIdentity();
  const user = await users.authenticate(identity);
  return { user, identity, users };
};
