import { loadConfig, validateRuntimeConfig } from './config/config.js';
import { createLogger } from './logging/logger.js';
import { runReportJob } from './jobs/reportJob.js';

const config = loadConfig();
const logger = createLogger({ level: config.logLevel, context: { service: 'notification-sender', mode: 'scheduler' } });
let running = false;

async function execute() {
  if (running) {
    logger.warn('report_job_skipped', { reason: 'previous_job_still_running' });
    return;
  }
  running = true;
  try { await runReportJob({ config, logger }); }
  catch (error) { logger.error('scheduled_report_failed', { error: error.message, stack: error.stack }); }
  finally { running = false; }
}

try {
  validateRuntimeConfig(config);
  const intervalMs = config.scheduler.intervalMinutes * 60_000;
  logger.info('service_started', {
    dryRun: config.delivery.dryRun,
    testMode: config.delivery.testMode,
    runOnStart: config.scheduler.runOnStart,
    scheduleIntervalMinutes: config.scheduler.intervalMinutes
  });
  if (config.scheduler.runOnStart) void execute();
  setInterval(() => void execute(), intervalMs);
} catch (error) {
  logger.error('service_configuration_invalid', { error: error.message });
  process.exitCode = 1;
}
