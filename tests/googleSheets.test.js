import test from 'node:test';
import assert from 'node:assert/strict';
import { readGoogleSheet } from '../src/data/googleSheets.js';

function response(payload, { ok = true, status = 200 } = {}) {
  const body = JSON.stringify(payload);
  return { ok, status, headers: { get: () => String(Buffer.byteLength(body)) }, text: async () => body };
}

const config = {
  bridgeUrl: 'https://script.google.com/macros/s/example-deployment/exec',
  bridgeToken: 'test-only-secret',
  bridgeTimeoutMs: 1000,
  maxResponseBytes: 10000,
  expectedSpreadsheetId: 'sheet-id',
  expectedTab: 'Sales Data Base Monthly'
};

test('reads the configured sheet through the Apps Script bridge without Google credentials', async () => {
  let request;
  const result = await readGoogleSheet(config, {
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return response({
        ok: true,
        spreadsheetId: 'sheet-id',
        tab: 'Sales Data Base Monthly',
        range: 'Sales Data Base Monthly!A1:DS2',
        generatedAt: '2026-09-06T00:00:00.000Z',
        values: [['ID'], ['1']]
      });
    }
  });
  assert.equal(result.source, 'apps_script_bridge');
  assert.deepEqual(result.values, [['ID'], ['1']]);
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { action: 'read_sales_data', token: 'test-only-secret' });
});

test('rejects non-Google bridge URLs before transmitting the bearer token', async () => {
  let called = false;
  await assert.rejects(
    readGoogleSheet({ ...config, bridgeUrl: 'https://example.com/bridge' }, { fetchImpl: async () => { called = true; } }),
    /approved Google Apps Script host/
  );
  assert.equal(called, false);
});

test('rejects bridge errors and unexpected tabs explicitly', async () => {
  await assert.rejects(
    readGoogleSheet(config, { fetchImpl: async () => response({ ok: false, error: 'unauthorized' }) }),
    /unauthorized/
  );
  await assert.rejects(
    readGoogleSheet(config, { fetchImpl: async () => response({ ok: true, spreadsheetId: 'sheet-id', tab: 'Wrong Tab', values: [] }) }),
    /unexpected tab/
  );
  await assert.rejects(
    readGoogleSheet(config, { fetchImpl: async () => response({ ok: true, spreadsheetId: 'wrong-sheet', tab: 'Sales Data Base Monthly', values: [] }) }),
    /unexpected spreadsheet/
  );
});
