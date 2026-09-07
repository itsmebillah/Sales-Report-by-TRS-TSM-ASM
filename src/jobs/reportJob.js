import path from 'node:path';
import { readFixture, readGoogleSheet } from '../data/googleSheets.js';
import { parseSheetValues } from '../data/sourceParser.js';
import { resolveHierarchy } from '../data/hierarchyResolver.js';
import { normalizeSource } from '../data/normalizer.js';
import { buildReports } from '../reports/reportBuilder.js';
import { renderReportPdf } from '../pdf/renderer.js';
import { createReportFilename, createReportId } from '../utils/reportIdentity.js';
import { blocksAutomaticDelivery, DeliveryStore, DELIVERY_STATUS } from './deliveryStore.js';
import { loadRecipientMappings, resolveRecipient } from '../whatsapp/recipientResolver.js';
import { WhatsAppWebSender } from '../whatsapp/sender.js';
import { applyDashboardSettings } from '../config/dashboard.js';
import { validateRuntimeConfig } from '../config/config.js';

function diagnosticSummary(diagnostics) {
  const byCode = {};
  const bySeverity = {};
  for (const diagnostic of diagnostics) {
    byCode[diagnostic.code] = (byCode[diagnostic.code] || 0) + 1;
    bySeverity[diagnostic.severity] = (bySeverity[diagnostic.severity] || 0) + 1;
  }
  return { total: diagnostics.length, byCode, bySeverity };
}

function caption(template, report) {
  return template
    .replaceAll('{reportType}', report.type.toUpperCase())
    .replaceAll('{entityName}', report.entity.name)
    .replaceAll('{month}', report.month);
}

export async function runReportJob({ config, fixturePath = null, logger, sender: suppliedSender = null }) {
  const startedAt = Date.now();
  const source = fixturePath ? await readFixture(fixturePath) : await readGoogleSheet(config.google);
  config = applyDashboardSettings(config, source.settings);
  validateRuntimeConfig(config, { fixturePath });
  logger.info('source_read_completed', { source: source.source, range: source.range, sourceRowCount: source.values.length });

  const parsed = parseSheetValues(source.values, {
    month: config.report.month,
    monthlyWorkingDays: config.report.monthlyWorkingDays
  });
  const hierarchy = resolveHierarchy(parsed, { conflictStrategy: config.report.hierarchyConflictStrategy });
  const normalized = normalizeSource(parsed, hierarchy);
  const diagnostics = diagnosticSummary(normalized.diagnostics);
  logger.info('data_quality_diagnostics', diagnostics);
  for (const item of normalized.diagnostics.filter((entry) => entry.severity === 'error')) {
    logger.error('data_quality_issue', item);
  }
  if (!normalized.month || !normalized.monthlyWorkingDays) {
    throw new Error('Report month and monthly working days are required after source parsing');
  }

  const completeReportSet = buildReports(normalized.records, { strictTargetCoverage: config.report.strictTargetCoverage });
  const enabledTypes = config.report.enabledTypes || { trs: true, tsm: true, asm: true };
  const reportSet = {
    ...completeReportSet,
    trs: enabledTypes.trs ? completeReportSet.trs : [],
    tsm: enabledTypes.tsm ? completeReportSet.tsm : [],
    asm: enabledTypes.asm ? completeReportSet.asm : []
  };
  reportSet.all = [...reportSet.trs, ...reportSet.tsm, ...reportSet.asm];
  const mappings = await loadRecipientMappings(config.recipientsFile);
  const store = new DeliveryStore(config.report.stateFile);
  const sender = suppliedSender || new WhatsAppWebSender(config.whatsapp);
  const results = [];

  try {
    for (const report of reportSet.all) {
    const reportId = createReportId({ type: report.type, entityId: report.entity.id, entityName: report.entity.name, month: report.month });
    if (!config.delivery.dryRun && config.delivery.testMode && reportId !== config.delivery.testReportId) {
      continue;
    }
    const fileName = createReportFilename({ type: report.type, entityName: report.entity.name, month: report.month, reportId });
    const filePath = path.join(config.report.outputDir, fileName);
    const reportLogger = logger.child({ reportId, reportType: report.type, entityName: report.entity.name, month: report.month });
    const previous = await store.get(reportId);
    if (!config.delivery.dryRun && blocksAutomaticDelivery(previous)) {
      const reason = previous.status === DELIVERY_STATUS.SENDING || previous.status === DELIVERY_STATUS.CONFIRMATION_PENDING
        ? 'previous_dispatch_requires_reconciliation'
        : 'already_sent';
      reportLogger.warn('report_delivery_skipped', { reason, previousStatus: previous.status, previousMessageId: previous.messageId });
      results.push({ reportId, status: DELIVERY_STATUS.SKIPPED, reason });
      continue;
    }

    try {
      await renderReportPdf(report, filePath, { reportId });
      await store.set(reportId, DELIVERY_STATUS.GENERATED, { filePath, sourceRowCount: report.sourceRowCount });
      reportLogger.info('report_generated', { sourceRowCount: report.sourceRowCount, generatedFile: filePath, status: DELIVERY_STATUS.GENERATED });
      const recipient = resolveRecipient(report, mappings, {
        testMode: config.delivery.testMode,
        testRecipient: config.whatsapp.testRecipient
      });
      if (!recipient.valid) reportLogger.warn('recipient_missing_or_invalid', { recipientSource: recipient.source });

      if (config.delivery.dryRun) {
        await store.set(reportId, DELIVERY_STATUS.DRY_RUN, { filePath, recipient: recipient.recipient });
        reportLogger.info('report_delivery_dry_run', { file: filePath, recipient: recipient.recipient, status: DELIVERY_STATUS.DRY_RUN });
        results.push({ reportId, status: DELIVERY_STATUS.DRY_RUN, filePath });
        continue;
      }
      if (!recipient.valid) {
        await store.set(reportId, DELIVERY_STATUS.SKIPPED, { filePath, reason: 'missing_or_invalid_recipient' });
        results.push({ reportId, status: DELIVERY_STATUS.SKIPPED, reason: 'missing_or_invalid_recipient' });
        continue;
      }

      await store.set(reportId, DELIVERY_STATUS.QUEUED, { filePath, recipient: recipient.recipient });
      await store.set(reportId, DELIVERY_STATUS.SENDING, { filePath, recipient: recipient.recipient });
      const delivery = await sender.sendDocument({
        recipient: recipient.recipient,
        filePath,
        caption: caption(config.whatsapp.captionTemplate, report)
      });
      if (delivery.success && delivery.outcome === 'CONFIRMED') {
        await store.set(reportId, DELIVERY_STATUS.SENT, { filePath, recipient: recipient.recipient, messageId: delivery.messageId, ack: delivery.ack });
        reportLogger.info('report_delivery_completed', { recipient: recipient.recipient, file: filePath, status: DELIVERY_STATUS.SENT, messageId: delivery.messageId, ack: delivery.ack });
        results.push({ reportId, status: DELIVERY_STATUS.SENT, messageId: delivery.messageId });
      } else if (delivery.outcome === 'CONFIRMATION_PENDING') {
        await store.set(reportId, DELIVERY_STATUS.CONFIRMATION_PENDING, { filePath, recipient: recipient.recipient, messageId: delivery.messageId, ack: delivery.ack, error: delivery.error });
        reportLogger.warn('report_delivery_confirmation_pending', { file: filePath, status: DELIVERY_STATUS.CONFIRMATION_PENDING, messageId: delivery.messageId, ack: delivery.ack, error: delivery.error });
        results.push({ reportId, status: DELIVERY_STATUS.CONFIRMATION_PENDING, messageId: delivery.messageId, error: delivery.error });
      } else {
        await store.set(reportId, DELIVERY_STATUS.FAILED, { filePath, error: delivery.error || 'definite_delivery_failure' });
        reportLogger.error('report_delivery_failed', { file: filePath, status: DELIVERY_STATUS.FAILED, error: delivery.error });
        results.push({ reportId, status: DELIVERY_STATUS.FAILED, error: delivery.error });
      }
    } catch (error) {
      await store.set(reportId, DELIVERY_STATUS.FAILED, { filePath, error: error.message });
      reportLogger.error('report_processing_failed', { file: filePath, status: DELIVERY_STATUS.FAILED, error: error.message });
      results.push({ reportId, status: DELIVERY_STATUS.FAILED, error: error.message });
    }
  }
  } finally {
    await sender.disconnect?.().catch((error) => logger.warn('whatsapp_disconnect_failed', { error: error.message }));
  }

  const statusCounts = results.reduce((counts, result) => ({ ...counts, [result.status]: (counts[result.status] || 0) + 1 }), {});
  const summary = {
    month: normalized.month,
    sourceRowCount: normalized.sourceRowCount,
    normalizedRecordCount: normalized.records.length,
    reports: { trs: reportSet.trs.length, tsm: reportSet.tsm.length, asm: reportSet.asm.length, total: reportSet.all.length },
    diagnostics,
    delivery: statusCounts,
    durationMs: Date.now() - startedAt
  };
  logger.info('report_job_completed', summary);
  return { summary, results, normalized, reportSet };
}
