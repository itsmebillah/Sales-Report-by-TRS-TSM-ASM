import path from 'node:path';
import { loadConfig, validateRuntimeConfig } from '../config/config.js';
import { createLogger } from '../logging/logger.js';
import { runReportJob } from '../jobs/reportJob.js';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const fixture = option('--fixture');
const forceDryRun = process.argv.includes('--dry-run');
const config = loadConfig(forceDryRun ? { DRY_RUN: 'true' } : {});
const fixturePath = fixture ? path.resolve(process.cwd(), fixture) : null;
const logger = createLogger({ level: config.logLevel, context: { service: 'notification-sender', mode: 'manual' } });

try {
  validateRuntimeConfig(config, { fixturePath });
  const result = await runReportJob({ config, fixturePath, logger });
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
  if (Object.keys(result.summary.delivery).includes('FAILED')) process.exitCode = 1;
} catch (error) {
  logger.error('manual_report_failed', { error: error.message, stack: error.stack });
  process.exitCode = 1;
}
