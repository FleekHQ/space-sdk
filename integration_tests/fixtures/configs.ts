import { UsersConfig, UserStorageConfig } from '@spacehq/sdk';

// eslint-disable-next-line import/no-extraneous-dependencies
require('dotenv').config({
  path: `${__dirname}/../.env`,
  debug: false,
});

// @todo: replace this by mocked service
const endpoint = process.env.HUB_AUTH_ENDPOINT || '';

export const TestUsersConfig: UsersConfig = {
  endpoint,
  vaultServiceConfig: {
    serviceUrl: process.env.VAULT_API_URL || '',
    saltSecret: process.env.VAULT_SALT_SECRET || '',
  },
};

export const TestsDefaultTimeout = 500000; // 500s

const textileHubAddress = process.env.TXL_HUB_URL;

export const TestStorageConfig: UserStorageConfig = {
  textileHubAddress,
};
