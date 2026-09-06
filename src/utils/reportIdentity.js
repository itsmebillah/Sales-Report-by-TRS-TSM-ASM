import { createHash } from 'node:crypto';
import { slugify } from './text.js';

export function createReportId({ type, entityId, entityName, month }) {
  const key = [month, type, entityId || entityName].join('|').toLowerCase();
  const digest = createHash('sha256').update(key).digest('hex').slice(0, 16);
  return `${month}:${type}:${digest}`;
}

export function createReportFilename({ type, entityName, month, reportId }) {
  const suffix = reportId.split(':').at(-1);
  return `${month}_${type}_${slugify(entityName)}_${suffix}.pdf`;
}
