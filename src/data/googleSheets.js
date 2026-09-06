import { readFile } from 'node:fs/promises';
import { google } from 'googleapis';
import { quoteSheetName } from '../utils/text.js';

export async function readGoogleSheet(config) {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const range = `${quoteSheetName(config.tab)}!${config.range}`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range,
    majorDimension: 'ROWS',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER'
  });
  return {
    source: 'google_sheets',
    spreadsheetId: config.sheetId,
    tab: config.tab,
    range: response.data.range,
    values: response.data.values || []
  };
}

export async function readFixture(fixturePath) {
  const payload = JSON.parse(await readFile(fixturePath, 'utf8'));
  if (!Array.isArray(payload.values)) throw new Error('Fixture must contain a values array');
  return { source: 'fixture', ...payload };
}
