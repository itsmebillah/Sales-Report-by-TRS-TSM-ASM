import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps-script/SalesDataBridge.js', import.meta.url), 'utf8');

function bridgeContext({ token = 'bridge-secret', requestToken = token } = {}) {
  let spreadsheetReads = 0;
  const output = () => ({
    text: '',
    setMimeType() { return this; }
  });
  const context = {
    console: { error() {} },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) { const value = output(); value.text = text; return value; }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => ({
          SALES_SPREADSHEET_ID: 'sheet-id',
          SALES_SHEET_TAB: 'Sales Data Base Monthly',
          SALES_BRIDGE_TOKEN: token,
          SALES_MAX_COLUMNS: '123'
        })[key] || null
      })
    },
    SpreadsheetApp: {
      openById: () => {
        spreadsheetReads += 1;
        return {
          getId: () => 'sheet-id',
          getSheetByName: () => ({
            getName: () => 'Sales Data Base Monthly',
            getLastRow: () => 2,
            getLastColumn: () => 2,
            getRange: () => ({ getValues: () => [['ID', 'Sales'], ['1', 100]], getA1Notation: () => 'A1:B2' })
          })
        };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const event = { postData: { contents: JSON.stringify({ action: 'read_sales_data', token: requestToken }) } };
  return { context, event, spreadsheetReads: () => spreadsheetReads };
}

test('Apps Script bridge reads only after token authorization', () => {
  const bridge = bridgeContext();
  const payload = JSON.parse(bridge.context.doPost(bridge.event).text);
  assert.equal(payload.ok, true);
  assert.equal(payload.spreadsheetId, 'sheet-id');
  assert.equal(payload.tab, 'Sales Data Base Monthly');
  assert.deepEqual(payload.values, [['ID', 'Sales'], ['1', 100]]);
  assert.equal(bridge.spreadsheetReads(), 1);
});

test('Apps Script bridge rejects a bad token before opening the spreadsheet', () => {
  const bridge = bridgeContext({ requestToken: 'wrong-secret' });
  const payload = JSON.parse(bridge.context.doPost(bridge.event).text);
  assert.deepEqual(payload, { ok: false, error: 'unauthorized' });
  assert.equal(bridge.spreadsheetReads(), 0);
});
