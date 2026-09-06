import { readFile } from 'node:fs/promises';
import { normalizeKey } from '../utils/text.js';

export function isValidRecipient(value) {
  return /^\+[1-9]\d{7,14}$/.test(String(value || ''));
}

export async function loadRecipientMappings(filePath) {
  try {
    const data = JSON.parse(await readFile(filePath, 'utf8'));
    return { asm: data.asm || {}, tsm: data.tsm || {}, trs: data.trs || {} };
  } catch (error) {
    if (error.code === 'ENOENT') return { asm: {}, tsm: {}, trs: {} };
    throw error;
  }
}

export function resolveRecipient(report, mappings, { testMode = true, testRecipient = '' } = {}) {
  const candidate = testMode
    ? testRecipient
    : mappings[report.type]?.[report.entity.id] || mappings[report.type]?.[normalizeKey(report.entity.name)] || '';
  return { recipient: candidate || null, valid: isValidRecipient(candidate), source: testMode ? 'test_override' : 'mapping' };
}
