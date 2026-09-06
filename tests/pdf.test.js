import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { renderReportPdf } from '../src/pdf/renderer.js';

test('renders a server-side PDF document', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sales-report-pdf-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'report.pdf');
  const metrics = { target: 100, sales: 50, achievementPercent: 50, dailyAverageSales: 10, requiredDailySales: 10, projection: 260, projectionPercent: 260, dailyAverageMemo: 2, averageMemoValue: 25, passedWorkingDays: 5, targetComplete: true, missingTargetCount: 0 };
  await renderReportPdf({ type: 'trs', entity: { name: 'TRS Alpha' }, parent: { name: 'TSM South' }, month: '2026-09', sourceRowCount: 1, rows: [{ entity: { name: 'Person One' }, metrics }], total: metrics }, file, { reportId: '2026-09:trs:test' });
  const header = (await readFile(file)).subarray(0, 5).toString();
  assert.equal(header, '%PDF-');
  assert.ok((await stat(file)).size > 1000);
});
