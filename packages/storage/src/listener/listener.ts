import { Client, Update, ThreadID } from '@textile/hub';
import { grpc } from '@improbable-eng/grpc-web';
import ee from 'event-emitter';

declare interface Bucket {
  name: string;
}

export class Listener {
  private listeners:Map<string, grpc.Request>;

  private client:Client;

  private emitters:ee.Emitter[];

  public constructor(dbids:string[], client:Client) {
    this.client = client;
    this.listeners = new Map();
    this.emitters = [];

    dbids.forEach((dbid) => {
      this.addListener(dbid);
    });
  }

  public addListener(dbid:string):void {
    if (this.listeners.has(dbid)) {
      throw new Error('Thread listener already exists');
    }

    const callback = (update?: Update<Bucket>) => {
      if (!update || !update.instance) return;
      this.emitters.forEach((emitter) => {
        emitter.emit('data', {
          bucketName: update.instance?.name,
        });
      });
    };

    const listener = this.client.listen(ThreadID.fromString(dbid), [], callback);
    this.listeners.set(dbid, listener);
  }

  public subscribe(emitter: ee.Emitter):void {
    this.emitters.push(emitter);
  }
}
