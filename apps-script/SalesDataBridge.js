const SALES_BRIDGE = Object.freeze({
  spreadsheetId: '1gkKk3rk-mvVO3CIulFCswD8GvFDHo_5TGzAIqBzYqC0',
  sourceTab: 'Sales Data Base Monthly',
  dashboardTab: 'Dashboard',
  tokenHashProperty: 'SALES_BRIDGE_TOKEN_SHA256',
  action: 'read_sales_data',
  sourceHeaderRow: 4,
  firstDataRow: 5,
  maxSourceColumn: 123,
  maxSourceRows: 2000,
  schemaVersion: 2
});

const PROJECTED_COLUMNS = Object.freeze([
  { header: 'ID', sourceColumn: 1 },
  { header: 'RSM', sourceColumn: 2 },
  { header: 'TSO', sourceColumn: 3 },
  { header: 'SR', sourceColumn: 4 },
  { header: 'Designation', sourceColumn: 6 },
  { header: 'AREA/ Point', sourceColumn: 14, hierarchyOnly: true },
  { headerFromSource: true, sourceColumn: 48 },
  { headerFromSource: true, sourceColumn: 65 },
  { header: 'No. of Order', sourceColumn: 50 },
  { header: 'Current WD', sourceColumn: 51 }
]);

const DASHBOARD_SETTINGS = Object.freeze({
  reportMonth: 'B14', monthlyWorkingDays: 'B15', enableTrsReports: 'B17',
  enableTsmReports: 'B18', enableAsmReports: 'B19', pdfOutputSettings: 'B20',
  reportGenerationMode: 'B21', whatsappEnabled: 'B24', dryRun: 'B25',
  testMode: 'B26', allowRealDelivery: 'B27', captionTemplate: 'B29',
  duplicateProtection: 'B30', retryAttempts: 'B31', retryDelaySeconds: 'B32'
});

function doPost(event) {
  try {
    const body = parseRequest_(event);
    if (!isAuthorized_(body.token)) return deniedResponse_();
    if (body.action !== SALES_BRIDGE.action) return deniedResponse_();
    if (!PROJECTED_COLUMNS.every((column) => column.sourceColumn <= SALES_BRIDGE.maxSourceColumn)) {
      return deniedResponse_();
    }

    const spreadsheet = SpreadsheetApp.openById(SALES_BRIDGE.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(SALES_BRIDGE.sourceTab);
    if (!sheet) return deniedResponse_();
    const lastRow = sheet.getLastRow();
    if (lastRow < SALES_BRIDGE.sourceHeaderRow || lastRow > SALES_BRIDGE.maxSourceRows) return deniedResponse_();

    return jsonResponse_({
      ok: true,
      schemaVersion: SALES_BRIDGE.schemaVersion,
      spreadsheetId: SALES_BRIDGE.spreadsheetId,
      tab: SALES_BRIDGE.sourceTab,
      range: `${SALES_BRIDGE.sourceTab}!A1:J${lastRow}`,
      generatedAt: new Date().toISOString(),
      settings: readDashboardSettings_(spreadsheet),
      values: projectSalesData_(sheet, lastRow)
    });
  } catch (error) {
    console.error('Sales bridge request failed');
    return deniedResponse_();
  }
}

function projectSalesData_(sheet, lastRow) {
  const headerCells = PROJECTED_COLUMNS.map((column) => column.headerFromSource
    ? sheet.getRange(SALES_BRIDGE.sourceHeaderRow, column.sourceColumn).getValue()
    : column.header);
  const dataRowCount = Math.max(0, lastRow - SALES_BRIDGE.firstDataRow + 1);
  const sourceColumns = PROJECTED_COLUMNS.map((column) => dataRowCount
    ? sheet.getRange(SALES_BRIDGE.firstDataRow, column.sourceColumn, dataRowCount, 1).getValues()
    : []);
  const rows = Array.from({ length: dataRowCount }, (_, rowIndex) => {
    const designation = String(sourceColumns[4][rowIndex][0] || '').trim();
    return PROJECTED_COLUMNS.map((column, columnIndex) => {
      if (column.hierarchyOnly && designation === 'SR') return '';
      return normalizeValue_(sourceColumns[columnIndex][rowIndex][0]);
    });
  });
  const monthLabel = String(headerCells[6] || '').replace(/^Sales of\s+/i, '').trim();
  return [
    ['', monthLabel],
    [],
    ['Monthly WD', normalizeValue_(sheet.getRange('AZ3').getValue())],
    headerCells.map(normalizeValue_),
    ...rows
  ];
}

function readDashboardSettings_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SALES_BRIDGE.dashboardTab);
  if (!sheet) return null;
  const result = {};
  Object.keys(DASHBOARD_SETTINGS).forEach((key) => {
    result[key] = normalizeValue_(sheet.getRange(DASHBOARD_SETTINGS[key]).getValue());
  });
  return result;
}

function parseRequest_(event) {
  const contents = event && event.postData && event.postData.contents ? event.postData.contents : '';
  if (!contents || contents.length > 4096) return {};
  try {
    const parsed = JSON.parse(contents);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function isAuthorized_(rawToken) {
  const expectedHash = String(PropertiesService.getScriptProperties()
    .getProperty(SALES_BRIDGE.tokenHashProperty) || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const token = typeof rawToken === 'string' ? rawToken : '';
  if (token.length < 43 || token.length > 512) return false;
  return safeEqual_(sha256Hex_(token), expectedHash);
}

function sha256Hex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map((byte) => ((byte + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function normalizeValue_(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function safeEqual_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function deniedResponse_() {
  return jsonResponse_({ ok: false, error: 'request_denied' });
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
