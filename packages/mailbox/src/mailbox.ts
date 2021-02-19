import { SpaceUser } from '@spacehq/users';
import { tryParsePublicKey } from '@spacehq/utils';
import { Users, UserAuth, UserMessage, PrivateKey, MailboxEvent } from '@textile/hub';
import { grpc } from '@improbable-eng/grpc-web';
import ee from 'event-emitter';

export interface MailboxConfig {
  textileHubAddress?: string;
  usersInit?: (auth: UserAuth) => Users;
}

export interface DecryptedUserMessage extends UserMessage {
  decryptedBody:Uint8Array;
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
  private listener?:grpc.Request;

  private emitters:ee.Emitter[];

  private constructor(private readonly user: SpaceUser, private readonly config: MailboxConfig = {}) {
    this.config.textileHubAddress = config.textileHubAddress ?? DefaultTextileHubAddress;
    this.emitters = [];
  }

  /**
   * Initializes the mailbox on the Textile hub server for this user
   *
   * @example
   * ```typescript
   * const mb = await MailBox.createMailbox(user);
   * ```
   */
  public static async createMailbox(
    user: SpaceUser,
    config: MailboxConfig = {},
    parser: (dec:DecryptedUserMessage) => {},
  ):Promise<Mailbox> {
    const mb = new Mailbox(user, config);
    const mid = await mb.getUsersClient().setupMailbox();

    const callback = (reply?: MailboxEvent, err?: Error) => {
      if (!reply || !reply.message) return;

      mb.emitters.forEach(async (emitter) => {
        if (reply.message) {
          const dec = await mb.messageDecoder(mb.user, reply.message);
          const parsed = await parser(dec);
          emitter.emit('data', { notification: parsed });
        }
      });
    };

    mb.listener = await mb.getUsersClient().watchInbox(mid, callback);
    return mb;
  }

  public subscribe(emitter: ee.Emitter):void {
    this.emitters.push(emitter);
  }

  /**
   * Get messages from a mailbox
   *
   * @example
   * ```typescript
   * const mb = await Mailbox.createMailbox(user);
   * // seek is a cursor to start the messages from
   * const msgs = await mb.ListInboxMessages(seek, limit);
   * ```
   */
  public async listInboxMessages(seek?:string, limit?:number):Promise<DecryptedUserMessage[]> {
    const res = await this.getUsersClient().listInboxMessages({
      seek, limit,
    });

    const inbox:DecryptedUserMessage[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const msg of res) {
      // eslint-disable-next-line no-await-in-loop
      const decryptedMsg = await this.messageDecoder(this.user, msg);
      inbox.push(decryptedMsg);
    }

    return inbox;
  }

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

  /**
   * Decrypts a user's inbox messages using their PrivateKey
   */
  messageDecoder = async (user: SpaceUser, message: UserMessage): Promise<DecryptedUserMessage> => {
    const identity = new PrivateKey(user.identity.privKey.slice(0, 32));
    const decryptedBody = await identity.decrypt(message.body);
    return { decryptedBody, ...message };
  }
}
