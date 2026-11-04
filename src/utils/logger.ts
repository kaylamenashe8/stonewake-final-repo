/* Tiny leveled logger. LOG_LEVEL=debug|info|warn|error (default info). */
const levels = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof levels)[number];
const min = levels.indexOf((process.env.LOG_LEVEL as Level | undefined) ?? 'info');

function emit(level: Level, msg: string, extra?: unknown): void {
  if (levels.indexOf(level) < min) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}`;
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  out.write(extra === undefined ? `${line}\n` : `${line} ${JSON.stringify(extra)}\n`);
}

export const logger = {
  debug: (m: string, e?: unknown) => { emit('debug', m, e); },
  info: (m: string, e?: unknown) => { emit('info', m, e); },
  warn: (m: string, e?: unknown) => { emit('warn', m, e); },
  error: (m: string, e?: unknown) => { emit('error', m, e); },
};
