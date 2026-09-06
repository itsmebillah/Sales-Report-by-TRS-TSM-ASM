import { readFile } from 'node:fs/promises';

const ALLOWED_BRIDGE_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com']);

function validateBridgeUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error('APPS_SCRIPT_BRIDGE_URL must be a valid URL'); }
  if (url.protocol !== 'https:' || !ALLOWED_BRIDGE_HOSTS.has(url.hostname)) {
    throw new Error('APPS_SCRIPT_BRIDGE_URL must use HTTPS on an approved Google Apps Script host');
  }
  return url;
}

async function responseTextWithLimit(response, maxBytes) {
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Apps Script bridge response exceeds ${maxBytes} bytes`);
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new Error(`Apps Script bridge response exceeds ${maxBytes} bytes`);
  }
  return text;
}

export async function readGoogleSheet(config, { fetchImpl = globalThis.fetch } = {}) {
  const url = validateBridgeUrl(config.bridgeUrl);
  const response = await fetchImpl(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'read_sales_data', token: config.bridgeToken }),
    signal: AbortSignal.timeout(config.bridgeTimeoutMs)
  });
  if (!response.ok) throw new Error(`Apps Script bridge HTTP ${response.status}`);
  const text = await responseTextWithLimit(response, config.maxResponseBytes);
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new Error('Apps Script bridge returned invalid JSON'); }
  if (!payload?.ok) throw new Error(`Apps Script bridge rejected the request: ${payload?.error || 'unknown_error'}`);
  if (!Array.isArray(payload.values)) throw new Error('Apps Script bridge response is missing a values array');
  if (config.expectedSpreadsheetId && payload.spreadsheetId !== config.expectedSpreadsheetId) {
    throw new Error(`Apps Script bridge returned unexpected spreadsheet: ${payload.spreadsheetId || '(missing)'}`);
  }
  if (config.expectedTab && payload.tab !== config.expectedTab) {
    throw new Error(`Apps Script bridge returned unexpected tab: ${payload.tab || '(missing)'}`);
  }
  return {
    source: 'apps_script_bridge',
    spreadsheetId: payload.spreadsheetId || null,
    tab: payload.tab,
    range: payload.range,
    values: payload.values,
    generatedAt: payload.generatedAt || null
  };
}

export async function readFixture(fixturePath) {
  const payload = JSON.parse(await readFile(fixturePath, 'utf8'));
  if (!Array.isArray(payload.values)) throw new Error('Fixture must contain a values array');
  return { source: 'fixture', ...payload };
}
