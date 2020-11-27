import { Client, ThreadID, Where } from '@textile/hub';
import { Context } from '@textile/context';
import multibase from 'multibase';
import SpaceAuth from '../auth';
import { threads } from '../utils';
import { ThreadKey } from '@textile/threads-core';
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

  /**
   * listDirectory
   */
  public async listDirectory(path: string, bucket: string) {
    const identity = await this.auth.getIdentity();

    await this.getMetathread();
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
    const identity = await this.auth.getIdentity();
    const threadId = threads.getDeterministicThreadID(identity);
    const dbs = await this.getClient().listThreads();
    console.log(dbs);
    console.log(threadId.toString());

    // // @ts-ignore (remove once @textile/threads-client updates their @textile/thread-id ref to 0.2.0)
    // const dbInfo = await this.getClient().getDBInfo(threadId);
    // console.log(dbInfo);
  }

  private async restoreMetathread() {
    const identity = await this.auth.getIdentity();
    const threadId = threads.getDeterministicThreadID(identity);

    let metathreadExists = true;
    try {
      // @ts-ignore (remove once @textile/threads-client updates their @textile/thread-id ref to 0.2.0)
      await this.getClient().getDBInfo(threadId);
    } catch {
      metathreadExists = false;
    }

    if (metathreadExists) {
      return;
    }

    const hubmaWithThreadId = `${this.textileMultiaddress}/thread/${threadId.toString()}`;
    debugger;

    const tid = await this.getClient().newDBFromAddr(
      hubmaWithThreadId,
      threads.getManagedThreadKey(identity, ThreadKeyVariant.metathreadVariant).toBytes(),
    );

    console.log('tid', tid);
  }
}

export default SpaceService;
