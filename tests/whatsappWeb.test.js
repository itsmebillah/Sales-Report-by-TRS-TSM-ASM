import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WhatsAppWebSender } from '../src/whatsapp/sender.js';

class FakeClient extends EventEmitter {
  constructor({ registered = true, ack = 1 } = {}) {
    super();
    this.registered = registered;
    this.ack = ack;
    this.sent = [];
  }

  async initialize() { queueMicrotask(() => this.emit('ready')); }
  async getNumberId(digits) { return this.registered ? { _serialized: `${digits}@c.us` } : null; }
  async sendMessage(jid, content, options) {
    this.sent.push({ jid, content, options });
    return { id: { _serialized: 'message-1' }, ack: this.ack };
  }
  async destroy() {}
}

function senderWith(client) {
  return new WhatsAppWebSender({
    enabled: true,
    sessionDir: '.test-session',
    sessionName: 'test',
    browserPath: '',
    headless: true,
    connectTimeoutMs: 1000,
    ackTimeoutMs: 5
  }, {
    clientFactory: () => client,
    localAuthFactory: (value) => value,
    mediaFactory: { fromFilePath: (filePath) => ({ mimetype: 'application/pdf', filename: filePath }) },
    qrRenderer: () => {},
    browserPathResolver: () => 'test-browser'
  });
}

test('sends a PDF as a WhatsApp Web document after server-side recipient validation', async () => {
  const client = new FakeClient();
  const sender = senderWith(client);
  const result = await sender.sendDocument({ recipient: '+999000000001', filePath: 'report.pdf', caption: 'Monthly report' });
  assert.equal(result.outcome, 'CONFIRMED');
  assert.equal(client.sent.length, 1);
  assert.equal(client.sent[0].jid, '999000000001@c.us');
  assert.equal(client.sent[0].options.sendMediaAsDocument, true);
  assert.equal(client.sent[0].options.caption, 'Monthly report');
  await sender.disconnect();
});

test('supports text and blocks unregistered recipients before dispatch', async () => {
  const client = new FakeClient({ registered: false });
  const sender = senderWith(client);
  const result = await sender.sendText({ recipient: '+999000000001', text: 'Test message' });
  assert.equal(result.outcome, 'DEFINITE_FAILURE');
  assert.equal(client.sent.length, 0);
  await sender.disconnect();
});

test('marks an unacknowledged dispatch as confirmation pending to prevent blind retry', async () => {
  const client = new FakeClient({ ack: 0 });
  const sender = senderWith(client);
  const result = await sender.sendText({ recipient: '+999000000001', text: 'Test message' });
  assert.equal(result.outcome, 'CONFIRMATION_PENDING');
  assert.equal(result.success, false);
  assert.equal(client.sent.length, 1);
  await sender.disconnect();
});
