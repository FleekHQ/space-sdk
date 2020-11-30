import { Client, ThreadID, Where, createAPISig } from '@textile/hub';
import { Context } from '@textile/context';
import SpaceAuth from '../auth';
import * as collections from '../collections';
import { threads } from '../utils';
import { ThreadKeyVariant } from '../utils/types';

class SpaceService {
  private hubUrl: string;
  private auth: SpaceAuth;
  private textileMultiaddress: string;

  constructor(auth: SpaceAuth, textileHubUrl: string, textileMultiaddress: string) {
    this.hubUrl = textileHubUrl;
    this.auth = auth;
    this.textileMultiaddress = textileMultiaddress;
  }

  public async listDirectory(path: string, bucket: string) {
    const identity = await this.auth.getIdentity();

    await this.getMetathread();

    // TODO: Iterate over metathread buckets, find the bucket being queried,
    // and return it files by querying `${bucket}_mirror` using the correct dbID
  }

  private getClient(): Client {
    let ctx: Context;
    if (this.hubUrl !== '') {
      ctx = new Context(this.hubUrl);
    } else {
      ctx = new Context();
    }

    const token = this.auth.getHubToken();

    ctx = ctx
      .withToken(token.token)
      .withAPIKey(token.key)
      .withAPISig({
        msg: token.msg,
        sig: token.sig,
      });

    return new Client(ctx, true);
  }

  private async getMetathread() {
    await this.restoreMetathread();

    // TODO: Return metathread
  }

  private async restoreMetathread() {
    const identity = await this.auth.getIdentity();
    const threadId = threads.getDeterministicThreadID(identity);

    let metathreadExists = true;
    try {
      // @ts-ignore (remove once @textile/threads-client updates their @textile/thread-id ref to 0.2.0)
      await this.getClient().getDBInfo(threadId);
    } catch (e) {
      console.error(e);
      metathreadExists = false;
    }

    // NOTE: this is always being false, as the golang method `getThread` is not implemented on JS side.
    // TODO: Check if there's other way to see if the metathread is replicated on the hub.
    if (metathreadExists) {
      return;
    }

    const hubmaWithThreadId = `${this.textileMultiaddress}/thread/${threadId.toString()}`;
    // NOTE: Currently failing with `duplicate key error`.
    const tid = await this.getClient().newDBFromAddr(
      hubmaWithThreadId,
      threads.getManagedThreadKey(identity, ThreadKeyVariant.metathreadVariant).toBytes(),
      [
        collections.Bucket.getCollectionConfig(),
        collections.MirrorFile.getCollectionConfig(),
        collections.ReceivedFile.getCollectionConfig(),
        collections.SentFile.getCollectionConfig(),
        collections.SharedPublicKey.getCollectionConfig(),
      ],
    );

    // TODO: Return restored metathread
  }
}

export default SpaceService;
