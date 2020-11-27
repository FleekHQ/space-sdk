export interface SpaceAPIOpts {
  /**
   * Currently defaults to https://webapi.hub.textile.io
   */
  hubUrl?: string;

  /**
   * Defaults to 30 min
   */
  sessionDurationInMs?: number;

  /**
   * Defaults to wss://auth.space.storage
   */
  spaceServicesAuthUrl?: string;

  /**
   * Defaults to WXpKd2JrMUlUbXhhYW10M1RWUkNlV0Z0YkhCYU1tUn
   */
  vaultSaltSecret?: string;

  /**
   * Defaults to https://vault.space.storage
   */
  vaultServiceUrl?: string;

  /**
   * Defaults to /ip4/52.186.99.239/tcp/4006/p2p/12D3KooWQEtCBXMKjVas6Ph1pUHG2T4Lc9j1KvnAipojP2xcKU7n
   */
  hubMultiaddress?: string;
}
