import { SpaceUser } from '@spacehq/users';
import { tryParsePublicKey } from '@spacehq/utils';
import { Users, UserAuth, UserMessage } from '@textile/hub';

export interface MailboxConfig {
  textileHubAddress?: string;
  usersInit?: (auth: UserAuth) => Users;
}

const DefaultTextileHubAddress = 'https://webapi.hub.textile.io';

/**
 * Mailbox performs mailbox actions on behalf of the user provided.
 *
 * @example
 * ```typescript
 *
 * const mb = await Mailbox.CreateMailbox(user);
 * await mb.sendMessage(pubkey, body);
 * ```
 */
export class Mailbox {
  private constructor(private readonly user: SpaceUser, private readonly config: MailboxConfig = {}) {
    this.config.textileHubAddress = config.textileHubAddress ?? DefaultTextileHubAddress;
  }

  /**
   * Initializes the mailbox on the Textile hub server for this user
   *
   * @example
   * ```typescript
   * const mb = await MailBox.createMailbox(user);
   * ```
   */
  public static async createMailbox(user: SpaceUser, config: MailboxConfig = {}):Promise<Mailbox> {
    const mb = new Mailbox(user, config);
    await mb.getUsersClient().setupMailbox();
    return mb;
  }

  //   public async ListInboxMessages(opts: InboxListOptions):[]UserMessage {
  //     const messages = await this.client.listInboxMessages();
  //     const inbox = [];
  //     messages.forEach(async (msg) => {
  //       inbox.push(await this.messageDecoder(msg));
  //     });
  // PrivateKey.fromString
  //   };

  /**
   * Send a message using mailbox
   *
   * @example
   * ```typescript
   * const mb = await Mailbox.createMailbox(user);
   * const sentMsg = await mb.sendMessage(pubkey, body);
   * ```
   */
  public async sendMessage(to: string, body:Uint8Array): Promise<UserMessage> {
    const toKey = tryParsePublicKey(to);
    const res = await this.getUsersClient().sendMessage(this.user.identity, toKey, body);
    return res;
  }

  private getUserAuth(): UserAuth {
    if (this.user.storageAuth === undefined) {
      // TODO: move this error to common package so it can be
      // imported without dep cycles
      throw new Error('Authentication Error');
    }
    return this.user.storageAuth;
  }

  private getUsersClient(): Users {
    return this.initUsers(this.getUserAuth());
  }

  private initUsers(userAuth: UserAuth): Users {
    if (this.config?.usersInit) {
      return this.config.usersInit(userAuth);
    }

    return Users.withUserAuth(userAuth, { host: this.config?.textileHubAddress });
  }

  // public WatchInbox():ee {

  // }

  // public Identity():PrivateKey {

  // }

  // private parseMessage(msgs:UserMessage[]) {

  // }

  /**
   * Decrypts a user's inbox messages using their PrivateKey
   */
  // messageDecoder = async (message: UserMessage): Promise<DecryptedInbox> => {
  //   const identity = PrivateKey.fromString(PrivateKeyIdentity);
  //   const bytes = await identity.decrypt(message.body);
  //   const body = new TextDecoder().decode(bytes);
  //   const { from } = message;
  //   const { readAt } = message;
  //   const { createdAt } = message;
  //   const { id } = message;
  //   return { body, from, readAt, sent: createdAt, id };
  // }
}
