/* eslint-disable no-unused-expressions */
import { AddItemsEventData,
  AddItemsResultSummary,
  UserStorage,
  ListDirectoryResponse,
  DirectoryEntry,
  FileNotFoundError,
  TxlSubscribeEventData } from '@spacehq/sdk';
import { isNode } from 'browser-or-node';
import fs from 'fs';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as chaiSubset from 'chai-subset';
import path from 'path';
import { TestsDefaultTimeout } from './fixtures/configs';
import { authenticateAnonymousUser } from './helpers/userHelper';

use(chaiAsPromised.default);
use(chaiSubset.default);

describe('Users storing data', () => {
  it('user should create an empty folder successfully', async () => {
    const { user } = await authenticateAnonymousUser();

    const storage = new UserStorage(user);
    await storage.createFolder({ bucket: 'personal', path: 'topFolder' });

    // verify folder is added
    const listFolder = await storage.listDirectory({ bucket: 'personal', path: '' });
    expect(listFolder.items).to.containSubset([
      {
        name: 'topFolder',
        isDir: true,
      },
    ]);

    // validate empty .keep file is at folders root
    const fileResponse = await storage.openFile({ bucket: 'personal', path: '/topFolder/.keep' });
    const keepFilesContent = await fileResponse.consumeStream();
    expect(keepFilesContent).to.be.empty;
  }).timeout(TestsDefaultTimeout);

  it('user should upload files successfully', async () => {
    const { user } = await authenticateAnonymousUser();
    const txtContent = 'Some manual text should be in the file';

    const storage = new UserStorage(user);
    const uploadResponse = await storage.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'top.txt',
          data: txtContent,
          mimeType: 'plain/text',
        },
        {
          path: 'subfolder/inner.txt',
          data: 'some other stuffs',
          mimeType: 'plain/text',
        },
      ],
    });

    let summary: AddItemsResultSummary | undefined;
    await new Promise((resolve) => {
      uploadResponse.once('done', (data: AddItemsEventData) => {
        summary = data as AddItemsResultSummary;
        resolve();
      });
    });

    expect(summary).to.containSubset({
      bucket: 'personal',
      files: [
        {
          path: '/top.txt',
          status: 'success',
        },
        {
          path: '/subfolder/inner.txt',
          status: 'success',
        },
        {
          path: '/subfolder',
          status: 'success',
        },
      ],
    });

    // 3rd level upload
    const anotheruploadResponse = await storage.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'firstfolder/secondfolder/file.txt',
          data: txtContent,
          mimeType: 'plain/text',
        },
      ],
    });

    // validate files are in the directory
    const listFolder = await storage.listDirectory({ bucket: 'personal', path: '' });
    expect(listFolder.items).to.containSubset([
      {
        name: 'top.txt',
        isDir: false,
      },
      {
        name: 'subfolder',
        isDir: true,
      },
    ]);

    const listFolder1 = await storage.listDirectory({ bucket: 'personal', path: 'firstfolder', recursive: false });
    expect(listFolder1).to.not.be.equals(null);
    if (listFolder1.items && listFolder1.items[0].items) {
      expect(listFolder1.items[0].items.length).to.be.equals(0);
    } else {
      expect(listFolder1.items).to.not.be.equals(null);
      expect(listFolder1.items[0].items).to.not.be.equals(null);
    }

    const listFolder1Rec:ListDirectoryResponse = await storage.listDirectory({ bucket: 'personal', path: 'firstfolder', recursive: true });
    expect(listFolder1Rec).to.not.be.equals(null);
    if (listFolder1Rec.items && listFolder1Rec.items[0].items) {
      expect(listFolder1Rec.items[0].items.length).to.be.greaterThan(0);
    } else {
      expect(listFolder1Rec.items).to.not.be.equals(null);
      expect(listFolder1Rec.items[0].items).to.not.be.equals(null);
    }

    // validate content of top.txt file
    const fileResponse = await storage.openFile({ bucket: 'personal', path: '/top.txt' });
    const actualTxtContent = await fileResponse.consumeStream();
    expect(new TextDecoder('utf8').decode(actualTxtContent)).to.equal(txtContent);
    expect(fileResponse.mimeType).to.equal('plain/text');
  }).timeout(TestsDefaultTimeout);

  it('should open large files successfully', async () => {
    if (!isNode) {
      return;
    }

    const { user } = await authenticateAnonymousUser();
    const imageBytes = fs.readFileSync(path.join(__dirname, 'test_data', 'image.jpg'));
    const storage = new UserStorage(user);
    const uploadResponse = await storage.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'image.jpg',
          data: imageBytes,
          mimeType: 'image/jpg',
        },
      ],
    });

    await new Promise<AddItemsEventData>((resolve) => {
      uploadResponse.once('done', resolve);
    });

    const openResponse = await storage.openFile({
      bucket: 'personal',
      path: '/image.jpg',
    });

    const actualBytes = await openResponse.consumeStream();
    expect(Buffer.from(actualBytes)).to.deep.equal(imageBytes);
  });

  it('should allow user access file via uuid', async () => {
    const { user } = await authenticateAnonymousUser();
    const txtContent = 'Some manual text should be in the file';

    const storage = new UserStorage(user);
    const uploadResponse = await storage.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'top.txt',
          data: txtContent,
          mimeType: 'plain/text',
        },
      ],
    });
    await new Promise((resolve) => {
      uploadResponse.once('done', (data: AddItemsEventData) => {
        resolve();
      });
    });

    const listFolder = await storage.listDirectory({ bucket: 'personal', path: '' });
    const file = listFolder.items.find((item: DirectoryEntry) => item.name.includes('top.txt'));
    expect(file).to.not.be.undefined;
    expect(file?.uuid).to.not.be.empty;

    const fileResponse = await storage.openFileByUuid(file?.uuid || '');
    expect(fileResponse.entry.name).to.equal('top.txt');
    const actualTxtContent = await fileResponse.consumeStream();
    expect(new TextDecoder('utf8').decode(actualTxtContent)).to.equal(txtContent);

    // ensure file is not accessible from outside of owners file
    const { user: unauthorizedUser } = await authenticateAnonymousUser();
    const unauthorizedStorage = new UserStorage(unauthorizedUser);

    await expect(unauthorizedStorage.openFileByUuid(file?.uuid || ''))
      .to.eventually.be.rejectedWith(FileNotFoundError);
  }).timeout(TestsDefaultTimeout);

  it('should subscribe to textile events', async (done) => {
    const { user } = await authenticateAnonymousUser();
    const txtContent = 'Some manual text should be in the file';

    const storage = new UserStorage(user);
    await storage.initListener();

    const ee = await storage.txlSubscribe();

    const eventData = new Promise<TxlSubscribeEventData>((resolve) => {
      ee.once('data', (d:TxlSubscribeEventData) => d);
    });

    const uploadResponse = await storage.addItems({
      bucket: 'personal',
      files: [
        {
          path: 'top.txt',
          data: txtContent,
          mimeType: 'plain/text',
        },
        {
          path: 'subfolder/inner.txt',
          data: 'some other stuffs',
          mimeType: 'plain/text',
        },
      ],
    });

    const data = await eventData;
    expect(data.bucketName).to.equal('personal');
    done();
  });
});
