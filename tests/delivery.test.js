import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { blocksAutomaticDelivery, DeliveryStore, DELIVERY_STATUS } from '../src/jobs/deliveryStore.js';
import { isValidRecipient, resolveRecipient } from '../src/whatsapp/recipientResolver.js';
import { createReportFilename, createReportId } from '../src/utils/reportIdentity.js';

test('delivery state persists exact statuses for duplicate protection', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sales-report-state-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new DeliveryStore(path.join(directory, 'deliveries.json'));
  await store.set('report-1', DELIVERY_STATUS.GENERATED, { filePath: 'one.pdf' });
  await store.set('report-1', DELIVERY_STATUS.SENT, { messageId: 'wamid.1' });
  const record = await store.get('report-1');
  assert.equal(record.status, DELIVERY_STATUS.SENT);
  assert.equal(record.filePath, 'one.pdf');
  assert.equal(record.messageId, 'wamid.1');
  assert.equal(record.everSent, true);
  assert.equal(record.history.length, 2);
  await store.set('report-1', DELIVERY_STATUS.DRY_RUN, { filePath: 'new-preview.pdf' });
  const afterPreview = await store.get('report-1');
  assert.equal(afterPreview.status, DELIVERY_STATUS.DRY_RUN);
  assert.equal(afterPreview.everSent, true);
  assert.equal(afterPreview.sentAt, record.sentAt);
});

test('uncertain WhatsApp dispatch states block automatic duplicate delivery', () => {
  assert.equal(blocksAutomaticDelivery({ status: DELIVERY_STATUS.SENDING }), true);
  assert.equal(blocksAutomaticDelivery({ status: DELIVERY_STATUS.CONFIRMATION_PENDING }), true);
  assert.equal(blocksAutomaticDelivery({ status: DELIVERY_STATUS.SENT, everSent: true }), true);
  assert.equal(blocksAutomaticDelivery({ status: DELIVERY_STATUS.FAILED }), false);
  assert.equal(blocksAutomaticDelivery(null), false);
});

test('recipient resolution supports IDs, normalized names, and test override', () => {
  const report = { type: 'trs', entity: { id: 'TRS01', name: 'TRS Alpha' } };
  const mappings = { asm: {}, tsm: {}, trs: { TRS01: '+999000000001', 'trs-alpha': '+999000000002' } };
  assert.equal(resolveRecipient(report, mappings, { testMode: false }).recipient, '+999000000001');
  assert.equal(resolveRecipient(report, mappings, { testMode: true, testRecipient: '+999000000003' }).recipient, '+999000000003');
  assert.equal(isValidRecipient('+999000000001'), true);
  assert.equal(isValidRecipient('not-e164'), false);
});

test('report IDs and filenames are deterministic and safe', () => {
  const input = { type: 'trs', entityId: 'TRS01', entityName: 'TRS Alpha / East', month: '2026-09' };
  const first = createReportId(input);
  assert.equal(first, createReportId(input));
  const filename = createReportFilename({ ...input, reportId: first });
  assert.match(filename, /^2026-09_trs_trs-alpha-east_[a-f0-9]{16}\.pdf$/);
});
