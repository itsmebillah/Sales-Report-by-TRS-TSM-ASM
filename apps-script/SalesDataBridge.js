const SALES_BRIDGE = Object.freeze({
  spreadsheetIdProperty: 'SALES_SPREADSHEET_ID',
  sheetTabProperty: 'SALES_SHEET_TAB',
  tokenProperty: 'SALES_BRIDGE_TOKEN',
  maxColumnsProperty: 'SALES_MAX_COLUMNS',
  defaultTab: 'Sales Data Base Monthly',
  defaultMaxColumns: 123,
  maxCells: 250000
});

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'sales-report-read-only-bridge',
    dataExposed: false
  });
}

function doPost(event) {
  try {
    const body = parseRequest_(event);
    if (body.action !== 'read_sales_data') return jsonResponse_({ ok: false, error: 'unsupported_action' });

    const properties = PropertiesService.getScriptProperties();
    const expectedToken = properties.getProperty(SALES_BRIDGE.tokenProperty) || '';
    if (!expectedToken || !safeEqual_(String(body.token || ''), expectedToken)) {
      return jsonResponse_({ ok: false, error: 'unauthorized' });
    }

    const spreadsheetId = properties.getProperty(SALES_BRIDGE.spreadsheetIdProperty) || '';
    const tab = properties.getProperty(SALES_BRIDGE.sheetTabProperty) || SALES_BRIDGE.defaultTab;
    const configuredMaxColumns = Number(properties.getProperty(SALES_BRIDGE.maxColumnsProperty));
    const maxColumns = Number.isInteger(configuredMaxColumns) && configuredMaxColumns > 0
      ? configuredMaxColumns
      : SALES_BRIDGE.defaultMaxColumns;
    if (!spreadsheetId) return jsonResponse_({ ok: false, error: 'bridge_not_configured' });

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(tab);
    if (!sheet) return jsonResponse_({ ok: false, error: 'configured_tab_not_found' });

    const rowCount = sheet.getLastRow();
    const columnCount = Math.min(sheet.getLastColumn(), maxColumns);
    if (rowCount * columnCount > SALES_BRIDGE.maxCells) {
      return jsonResponse_({ ok: false, error: 'configured_range_too_large' });
    }

    const range = rowCount && columnCount ? sheet.getRange(1, 1, rowCount, columnCount) : null;
    const values = range ? normalizeValues_(range.getValues()) : [];
    return jsonResponse_({
      ok: true,
      spreadsheetId: spreadsheet.getId(),
      tab: sheet.getName(),
      range: range ? `${sheet.getName()}!${range.getA1Notation()}` : `${sheet.getName()}!A1`,
      generatedAt: new Date().toISOString(),
      values
    });
  } catch (error) {
    console.error(`Sales bridge read failed: ${error && error.message ? error.message : 'unknown error'}`);
    return jsonResponse_({ ok: false, error: 'bridge_read_failed' });
  }
}

function parseRequest_(event) {
  const contents = event && event.postData && event.postData.contents ? event.postData.contents : '';
  if (!contents || contents.length > 4096) throw new Error('Invalid request body');
  return JSON.parse(contents);
}

function normalizeValues_(values) {
  return values.map((row) => row.map((value) => value instanceof Date ? value.toISOString() : value));
}

function safeEqual_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
