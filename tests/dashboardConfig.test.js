import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDashboardSettings } from '../src/config/dashboard.js';

function baseConfig() {
  return {
    report: { month: '', monthlyWorkingDays: null },
    delivery: { dryRun: true, testMode: true, allowRealDelivery: false, testReportId: '' },
    whatsapp: { enabled: false, captionTemplate: 'default' }
  };
}

test('Dashboard controls non-secret report settings', () => {
  const result = applyDashboardSettings(baseConfig(), {
    reportMonth: '2026-09', monthlyWorkingDays: 26, enableTrsReports: false,
    enableTsmReports: true, enableAsmReports: true, captionTemplate: 'Report {month}'
  });
  assert.equal(result.report.month, '2026-09');
  assert.equal(result.report.monthlyWorkingDays, 26);
  assert.deepEqual(result.report.enabledTypes, { trs: false, tsm: true, asm: true });
  assert.equal(result.whatsapp.captionTemplate, 'Report {month}');
});

test('Dashboard cannot weaken environment delivery safety floors', () => {
  const result = applyDashboardSettings(baseConfig(), {
    dryRun: false, testMode: false, whatsappEnabled: true, allowRealDelivery: true,
    duplicateProtection: false
  });
  assert.equal(result.delivery.dryRun, true);
  assert.equal(result.delivery.testMode, true);
  assert.equal(result.delivery.allowRealDelivery, false);
  assert.equal(result.delivery.duplicateProtection, true);
  assert.equal(result.whatsapp.enabled, false);
});

test('Dashboard report mode limits output to one enabled level and bounds retry values', () => {
  const result = applyDashboardSettings(baseConfig(), {
    reportGenerationMode: 'TSM', enableTrsReports: true, enableTsmReports: true,
    enableAsmReports: true, retryAttempts: 999, retryDelaySeconds: 99999
  });
  assert.deepEqual(result.report.enabledTypes, { trs: false, tsm: true, asm: false });
  assert.equal(result.delivery.retryAttempts, 5);
  assert.equal(result.delivery.retryDelaySeconds, 3600);
});
