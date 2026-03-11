const dayjs = require('dayjs');

/**
 * Logger centralizado con timestamps.
 * Niveles: info, warn, error, success
 */
const logger = {
  info: (msg, ...args) => {
    console.log(`[${dayjs().format('HH:mm:ss')}] ℹ️  ${msg}`, ...args);
  },
  warn: (msg, ...args) => {
    console.warn(`[${dayjs().format('HH:mm:ss')}] ⚠️  ${msg}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`[${dayjs().format('HH:mm:ss')}] ❌ ${msg}`, ...args);
  },
  success: (msg, ...args) => {
    console.log(`[${dayjs().format('HH:mm:ss')}] ✅ ${msg}`, ...args);
  },
};

module.exports = logger;
