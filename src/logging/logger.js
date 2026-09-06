const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger({ level = 'info', context = {} } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const emit = (severity, event, fields = {}) => {
    if (LEVELS[severity] < threshold) return;
    const payload = {
      timestamp: new Date().toISOString(),
      level: severity,
      event,
      ...context,
      ...fields
    };
    const target = severity === 'error' ? process.stderr : process.stdout;
    target.write(`${JSON.stringify(payload)}\n`);
  };
  return {
    debug: (event, fields) => emit('debug', event, fields),
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
    child: (more) => createLogger({ level, context: { ...context, ...more } })
  };
}
