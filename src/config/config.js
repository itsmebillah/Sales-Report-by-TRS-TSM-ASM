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
      dataSource: env.GOOGLE_DATA_SOURCE || 'apps_script',
      bridgeUrl: env.APPS_SCRIPT_BRIDGE_URL || '',
      bridgeToken: env.APPS_SCRIPT_BRIDGE_TOKEN || '',
      bridgeTimeoutMs: positiveInt(env.APPS_SCRIPT_BRIDGE_TIMEOUT_MS, 60_000),
      maxResponseBytes: positiveInt(env.APPS_SCRIPT_BRIDGE_MAX_RESPONSE_BYTES, 15_000_000),
      expectedSpreadsheetId: env.GOOGLE_SHEET_ID || '',
      expectedTab: env.GOOGLE_SHEET_TAB || 'Sales Data Base Monthly'
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
      allowRealDelivery: bool(env.ALLOW_REAL_DELIVERY, false),
      testReportId: env.WHATSAPP_TEST_REPORT_ID || ''
    },
    whatsapp: {
      enabled: bool(env.WHATSAPP_ENABLED, false),
      testRecipient: env.WHATSAPP_TEST_RECIPIENT || '',
      captionTemplate: env.WHATSAPP_CAPTION_TEMPLATE || 'Monthly {reportType} performance report for {entityName} - {month}',
      sessionDir: path.resolve(cwd, env.WHATSAPP_SESSION_DIR || '.wwebjs_auth'),
      sessionName: env.WHATSAPP_SESSION_NAME || 'sales-report',
      browserPath: env.WHATSAPP_BROWSER_PATH || '',
      headless: bool(env.WHATSAPP_HEADLESS, true),
      connectTimeoutMs: positiveInt(env.WHATSAPP_CONNECT_TIMEOUT_MS, 120_000),
      ackTimeoutMs: positiveInt(env.WHATSAPP_ACK_TIMEOUT_MS, 30_000)
    },
    scheduler: {
      runOnStart: bool(env.RUN_ON_START, false),
      intervalMinutes: positiveInt(env.SCHEDULE_INTERVAL_MINUTES, 1440)
    }
  };
}

export function validateRuntimeConfig(config, { fixturePath } = {}) {
  if (!fixturePath && config.google.dataSource !== 'apps_script') {
    throw new Error(`Unsupported GOOGLE_DATA_SOURCE: ${config.google.dataSource}`);
  }
  if (!fixturePath && !config.google.bridgeUrl) throw new Error('APPS_SCRIPT_BRIDGE_URL is required');
  if (!fixturePath && !config.google.bridgeToken) throw new Error('APPS_SCRIPT_BRIDGE_TOKEN is required');
  if (!fixturePath && !config.google.expectedSpreadsheetId) throw new Error('GOOGLE_SHEET_ID is required for source verification');
  if (!config.delivery.dryRun && !config.whatsapp.enabled) {
    throw new Error('Real run requested while WHATSAPP_ENABLED is false');
  }
  if (!config.delivery.dryRun && config.delivery.testMode && !config.whatsapp.testRecipient) {
    throw new Error('WHATSAPP_TEST_RECIPIENT is required when TEST_MODE=true and DRY_RUN=false');
  }
  if (!config.delivery.dryRun && config.delivery.testMode && !config.delivery.testReportId) {
    throw new Error('WHATSAPP_TEST_REPORT_ID is required to limit test delivery to exactly one report');
  }
  if (!config.delivery.dryRun && !config.delivery.testMode && !config.delivery.allowRealDelivery) {
    throw new Error('Production delivery requires ALLOW_REAL_DELIVERY=true');
  }
}
