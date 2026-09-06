import 'dotenv/config';
import path from 'node:path';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function bool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const cwd = env.PROJECT_ROOT ? path.resolve(env.PROJECT_ROOT) : process.cwd();
  const conflictStrategy = env.HIERARCHY_CONFLICT_STRATEGY || 'summary_wins';
  if (!['summary_wins', 'separator_wins', 'error'].includes(conflictStrategy)) {
    throw new Error(`Invalid HIERARCHY_CONFLICT_STRATEGY: ${conflictStrategy}`);
  }

  return {
    env: env.NODE_ENV || 'development',
    logLevel: env.LOG_LEVEL || 'info',
    google: {
      sheetId: env.GOOGLE_SHEET_ID || '',
      tab: env.GOOGLE_SHEET_TAB || 'Sales Data Base Monthly',
      range: env.GOOGLE_SHEET_RANGE || 'A:DS'
    },
    report: {
      outputDir: path.resolve(cwd, env.REPORT_OUTPUT_DIR || 'output/pdf'),
      stateFile: path.resolve(cwd, env.REPORT_STATE_FILE || 'output/state/deliveries.json'),
      month: env.REPORT_MONTH || '',
      monthlyWorkingDays: env.MONTHLY_WORKING_DAYS ? positiveInt(env.MONTHLY_WORKING_DAYS, null) : null,
      strictTargetCoverage: bool(env.STRICT_TARGET_COVERAGE, true),
      hierarchyConflictStrategy: conflictStrategy
    },
    recipientsFile: path.resolve(cwd, env.RECIPIENT_MAPPING_FILE || 'config/recipients.json'),
    delivery: {
      dryRun: bool(env.DRY_RUN, true),
      testMode: bool(env.TEST_MODE, true),
      allowRealDelivery: bool(env.ALLOW_REAL_DELIVERY, false)
    },
    whatsapp: {
      enabled: bool(env.WHATSAPP_ENABLED, false),
      apiVersion: env.WHATSAPP_GRAPH_API_VERSION || 'v23.0',
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: env.WHATSAPP_ACCESS_TOKEN || '',
      testRecipient: env.WHATSAPP_TEST_RECIPIENT || '',
      captionTemplate: env.WHATSAPP_CAPTION_TEMPLATE || 'Monthly {reportType} performance report for {entityName} - {month}'
    },
    scheduler: {
      runOnStart: bool(env.RUN_ON_START, false),
      intervalMinutes: positiveInt(env.SCHEDULE_INTERVAL_MINUTES, 1440)
    }
  };
}

export function validateRuntimeConfig(config, { fixturePath } = {}) {
  if (!fixturePath && !config.google.sheetId) throw new Error('GOOGLE_SHEET_ID is required');
  if (!config.delivery.dryRun && !config.whatsapp.enabled) {
    throw new Error('Real run requested while WHATSAPP_ENABLED is false');
  }
  if (!config.delivery.dryRun && config.delivery.testMode && !config.whatsapp.testRecipient) {
    throw new Error('WHATSAPP_TEST_RECIPIENT is required when TEST_MODE=true and DRY_RUN=false');
  }
  if (!config.delivery.dryRun && !config.delivery.testMode && !config.delivery.allowRealDelivery) {
    throw new Error('Production delivery requires ALLOW_REAL_DELIVERY=true');
  }
}
