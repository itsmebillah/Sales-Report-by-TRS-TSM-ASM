import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps-script/SalesDataBridge.js', import.meta.url), 'utf8');
const RAW_TOKEN = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFG';

function bridgeContext({ request = { action: 'read_sales_data', token: RAW_TOKEN }, tokenHash } = {}) {
  let spreadsheetReads = 0;
  const columns = new Map([
    [1, [null, 3018]], [2, ['Manager', 'Manager']], [3, ['TRS One', 'TRS One']],
    [4, [null, 'Field Person']], [6, [null, 'SR']],
    [14, ['Territory One', 'Sensitive Dealer Name']], [48, [null, 100]],
    [50, [null, 2]], [51, [null, 1]], [65, [null, 500]]
  ]);
  const sheet = {
    getName: () => 'Sales Data Base Monthly',
    getLastRow: () => 6,
    getRange(rowOrA1, column, rowCount) {
      if (rowOrA1 === 'AZ3') return { getValue: () => 26 };
      if (rowOrA1 === 4) {
        const header = new Map([[48, "Sales of September'26"], [65, "September'26 Monthly Tgt. Product Wise Value"]]);
        return { getValue: () => header.get(column) };
      }
      return { getValues: () => (columns.get(column) || []).slice(0, rowCount).map((value) => [value]) };
    }
  };
  const dashboard = { getRange: () => ({ getValue: () => '' }) };
  const context = {
    console: { error() {} },
    Date,
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) { return { text, setMimeType() { return this; } }; }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => tokenHash ?? crypto.createHash('sha256').update(RAW_TOKEN).digest('hex')
      })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(value).digest()]
    },
    SpreadsheetApp: {
      openById(id) {
        assert.equal(id, '1gkKk3rk-mvVO3CIulFCswD8GvFDHo_5TGzAIqBzYqC0');
        spreadsheetReads += 1;
        return { getSheetByName: (name) => name === 'Dashboard' ? dashboard : sheet };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const event = { postData: { contents: JSON.stringify(request) } };
  return { context, event, spreadsheetReads: () => spreadsheetReads };
}

test('bridge has no GET endpoint and authorizes before reading', () => {
  const bridge = bridgeContext();
  assert.equal(typeof bridge.context.doGet, 'undefined');
  const payload = JSON.parse(bridge.context.doPost(bridge.event).text);
  assert.equal(payload.ok, true);
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.spreadsheetId, '1gkKk3rk-mvVO3CIulFCswD8GvFDHo_5TGzAIqBzYqC0');
  assert.equal(payload.tab, 'Sales Data Base Monthly');
  assert.equal(bridge.spreadsheetReads(), 1);
});

test('invalid token and unauthenticated unsupported action have identical generic responses', () => {
  const badToken = bridgeContext({ request: { action: 'read_sales_data', token: 'wrong' } });
  const unsupported = bridgeContext({ request: { action: 'probe', token: 'wrong' } });
  const expected = { ok: false, error: 'request_denied' };
  assert.deepEqual(JSON.parse(badToken.context.doPost(badToken.event).text), expected);
  assert.deepEqual(JSON.parse(unsupported.context.doPost(unsupported.event).text), expected);
  assert.equal(badToken.spreadsheetReads(), 0);
  assert.equal(unsupported.spreadsheetReads(), 0);
});

test('projection contains only approved fields and suppresses SR dealer/customer text', () => {
  const bridge = bridgeContext();
  const payload = JSON.parse(bridge.context.doPost(bridge.event).text);
  assert.deepEqual(payload.values[3], [
    'ID', 'RSM', 'TSO', 'SR', 'Designation', 'AREA/ Point', "Sales of September'26",
    "September'26 Monthly Tgt. Product Wise Value", 'No. of Order', 'Current WD'
  ]);
  assert.equal(payload.values[4][5], 'Territory One');
  assert.equal(payload.values[5][5], '');
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /Sensitive Dealer Name|salary|TADA|joining|phone/i);
  assert.equal(payload.values[5][6], 100);
  assert.equal(payload.values[5][7], 500);
});

test('caller-supplied spreadsheet, tab, and range are ignored', () => {
  const bridge = bridgeContext({ request: {
    action: 'read_sales_data', token: RAW_TOKEN, spreadsheetId: 'other', tab: 'Secrets', range: 'A:ZZZ'
  } });
  const payload = JSON.parse(bridge.context.doPost(bridge.event).text);
  assert.equal(payload.spreadsheetId, '1gkKk3rk-mvVO3CIulFCswD8GvFDHo_5TGzAIqBzYqC0');
  assert.equal(payload.tab, 'Sales Data Base Monthly');
  assert.match(payload.range, /!A1:J6$/);
});
