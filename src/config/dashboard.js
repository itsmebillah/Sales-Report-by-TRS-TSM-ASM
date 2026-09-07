const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function dashboardBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

function dashboardPositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function configuredText(value) {
  const text = String(value ?? '').trim();
  return text && text.toLowerCase() !== 'auto' ? text : '';
}

function reportMonth(value) {
  const text = configuredText(value);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : '';
}

function caption(value) {
  const text = configuredText(value);
  return text.length <= 500 ? text : '';
}

export function applyDashboardSettings(config, rawSettings) {
  if (!rawSettings || typeof rawSettings !== 'object') {
    return {
      ...config,
      report: { ...config.report, enabledTypes: { trs: true, tsm: true, asm: true } }
    };
  }
  const settings = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const dashboardDryRun = dashboardBool(settings.dryRun, true);
  const dashboardTestMode = dashboardBool(settings.testMode, true);
  const dashboardWhatsapp = dashboardBool(settings.whatsappEnabled, false);
  const dashboardRealDelivery = dashboardBool(settings.allowRealDelivery, false);
  const captionTemplate = caption(settings.captionTemplate);
  const requestedMode = configuredText(settings.reportGenerationMode).toLowerCase();
  const generationMode = ['all', 'trs', 'tsm', 'asm'].includes(requestedMode) ? requestedMode : 'all';
  const enabledTypes = {
    trs: dashboardBool(settings.enableTrsReports, true),
    tsm: dashboardBool(settings.enableTsmReports, true),
    asm: dashboardBool(settings.enableAsmReports, true)
  };
  if (generationMode !== 'all') {
    Object.keys(enabledTypes).forEach((type) => { enabledTypes[type] = enabledTypes[type] && type === generationMode; });
  }

  return {
    ...config,
    report: {
      ...config.report,
      month: reportMonth(settings.reportMonth) || config.report.month,
      monthlyWorkingDays: dashboardPositiveInt(settings.monthlyWorkingDays) || config.report.monthlyWorkingDays,
      enabledTypes,
      generationMode,
      pdfOutputSettings: configuredText(settings.pdfOutputSettings) === 'standard' ? 'standard' : 'standard'
    },
    delivery: {
      ...config.delivery,
      dryRun: config.delivery.dryRun || dashboardDryRun,
      testMode: config.delivery.testMode || dashboardTestMode,
      allowRealDelivery: config.delivery.allowRealDelivery && dashboardRealDelivery,
      duplicateProtection: true,
      retryAttempts: Math.min(dashboardPositiveInt(settings.retryAttempts) || 1, 5),
      retryDelaySeconds: Math.min(dashboardPositiveInt(settings.retryDelaySeconds) || 30, 3600)
    },
    whatsapp: {
      ...config.whatsapp,
      enabled: config.whatsapp.enabled && dashboardWhatsapp,
      captionTemplate: captionTemplate || config.whatsapp.captionTemplate
    }
  };
}
