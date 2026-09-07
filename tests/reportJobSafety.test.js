import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config/config.js';
import { runReportJob } from '../src/jobs/reportJob.js';

const fixturePath = path.resolve('tests/fixtures/source-sheet.json');
const logger = {
  info() {}, warn() {}, error() {},
  child() { return this; }
};

function testConfig(root, overrides = {}) {
  return loadConfig({
    PROJECT_ROOT: root,
    DRY_RUN: 'true',
    TEST_MODE: 'true',
    WHATSAPP_ENABLED: 'false',
    WHATSAPP_TEST_RECIPIENT: '+999000000001',
    ...overrides
  });
}

test('dry-run generates reports without initializing or sending through WhatsApp', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sales-report-dry-run-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let sends = 0;
  const sender = {
    async sendDocument() { sends += 1; throw new Error('must not send'); },
    async disconnect() {}
  };
  const result = await runReportJob({ config: testConfig(root), fixturePath, logger, sender });
  assert.equal(result.summary.reports.total, 6);
  assert.deepEqual(result.summary.delivery, { DRY_RUN: 6 });
  assert.equal(sends, 0);
});

test('confirmation-pending records are not automatically delivered a second time', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sales-report-pending-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let sends = 0;
  const sender = {
    async sendDocument() {
      sends += 1;
      return { success: false, outcome: 'CONFIRMATION_PENDING', messageId: `message-${sends}`, ack: 0 };
    },
    async disconnect() {}
  };
  const dryResult = await runReportJob({ config: testConfig(root), fixturePath, logger, sender });
  const selectedReportId = dryResult.results[0].reportId;
  const config = testConfig(root, {
    DRY_RUN: 'false', WHATSAPP_ENABLED: 'true', WHATSAPP_TEST_REPORT_ID: selectedReportId
  });
  const first = await runReportJob({ config, fixturePath, logger, sender });
  assert.deepEqual(first.summary.delivery, { CONFIRMATION_PENDING: 1 });
  assert.equal(sends, 1);
  const second = await runReportJob({ config, fixturePath, logger, sender });
  assert.deepEqual(second.summary.delivery, { SKIPPED: 1 });
  assert.equal(sends, 1);
});
