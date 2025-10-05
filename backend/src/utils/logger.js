let pinoLib;
try {
  pinoLib = require('pino');
} catch (e) {
  // Fallback shim so the app does not crash if dependency missing
  const noop = () => {};
  const consoleShim = {
    info: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    fatal: console.error.bind(console),
    debug: console.debug.bind(console),
    child: () => consoleShim
  };
  module.exports = consoleShim;
  return;
}

const logger = pinoLib({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: { translateTime: 'SYS:standard', colorize: true }
  }
});

module.exports = logger;
