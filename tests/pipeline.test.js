import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSheetValues } from '../src/data/sourceParser.js';
import { resolveHierarchy } from '../src/data/hierarchyResolver.js';
import { normalizeSource } from '../src/data/normalizer.js';
import { buildReports } from '../src/reports/reportBuilder.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/source-sheet.json', import.meta.url), 'utf8'));

function pipeline(values = fixture.values, strategy = 'summary_wins') {
  const parsed = parseSheetValues(values);
  const hierarchy = resolveHierarchy(parsed, { conflictStrategy: strategy });
  const normalized = normalizeSource(parsed, hierarchy);
  return { parsed, hierarchy, normalized, reports: buildReports(normalized.records, { strictTargetCoverage: true }) };
}

test('discovers headers and translates source hierarchy into ASM/TSM/TRS', () => {
  const result = pipeline();
  assert.equal(result.parsed.headerRowNumber, 4);
  assert.equal(result.parsed.month, '2026-09');
  assert.equal(result.parsed.monthlyWorkingDays, 26);
  assert.equal(result.normalized.records.length, 3);
  assert.equal(result.normalized.records[0].asm.name, 'ASM South');
  assert.equal(result.normalized.records[0].tsm.name, 'TSM South');
  assert.equal(result.normalized.records[0].trs.name, 'TRS Alpha');
  assert.equal(result.normalized.records[0].territory, 'Territory Alpha');
});

test('builds TRS, TSM, and ASM reports from underlying records', () => {
  const { reports } = pipeline();
  assert.equal(reports.trs.length, 2);
  assert.equal(reports.tsm.length, 2);
  assert.equal(reports.asm.length, 2);
  const alpha = reports.trs.find((report) => report.entity.name === 'TRS Alpha');
  assert.equal(alpha.sourceRowCount, 2);
  assert.equal(alpha.total.sales, 100000);
  assert.equal(alpha.total.target, 300000);
  assert.equal(alpha.total.orders, 50);
  assert.equal(alpha.total.passedWorkingDays, 6);
  assert.equal(alpha.total.achievementPercent, 100000 / 300000 * 100);
  const north = reports.asm.find((report) => report.entity.name === 'ASM North');
  assert.equal(north.total.target, null);
  assert.equal(north.total.achievementPercent, null);
  assert.equal(north.total.missingTargetCount, 1);
});

test('reports hierarchy conflicts and applies configured strategy explicitly', () => {
  const values = structuredClone(fixture.values);
  values[4][1] = 'Wrong TSM';
  const summaryWins = pipeline(values, 'summary_wins');
  const diagnostic = summaryWins.normalized.diagnostics.find((item) => item.code === 'CONFLICTING_TRS_TSM_MAPPING');
  assert.ok(diagnostic);
  assert.equal(summaryWins.normalized.records[0].tsm.name, 'TSM South');
  const separatorWins = pipeline(values, 'separator_wins');
  assert.equal(separatorWins.normalized.records[0].tsm.name, 'Wrong TSM');
  assert.equal(separatorWins.normalized.records[0].asm, null);
  assert.throws(() => pipeline(values, 'error'), /Hierarchy conflict/);
});

test('reports orphan TRS summaries instead of silently accepting them', () => {
  const values = structuredClone(fixture.values);
  values.splice(8, 0, [null, null, null, null, 'T.S.O.']);
  const result = pipeline(values);
  assert.ok(result.normalized.diagnostics.some((item) => item.code === 'ORPHAN_TRS_SUMMARY'));
});
