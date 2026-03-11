const { syncBusinessReviews } = require('../services/syncService');
const logger = require('../utils/logger');

let syncInterval = null;

/**
 * Inicia el job de sincronización periódica.
 * Por defecto se ejecuta cada 60 segundos (configurable via SYNC_INTERVAL_MS).
 */
function startSyncJob() {
  const placeId = process.env.PLACE_ID;
  const intervalMs = parseInt(process.env.SYNC_INTERVAL_MS, 10) || 60000;

  if (!placeId) {
    logger.warn('PLACE_ID no configurado. El job de sync no se iniciará.');
    return;
  }

  logger.info(`🕒 Job de sync iniciado. Intervalo: ${intervalMs / 1000}s | PlaceId: ${placeId}`);

  // Primera sincronización inmediata al arrancar
  runSync(placeId);

  // Polling periódico
  syncInterval = setInterval(() => {
    runSync(placeId);
  }, intervalMs);
}

/**
 * Detiene el job de sincronización.
 */
function stopSyncJob() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    logger.info('Job de sync detenido.');
  }
}

/**
 * Ejecuta una sincronización individual con manejo de errores.
 */
async function runSync(placeId) {
  try {
    await syncBusinessReviews(placeId);
  } catch (error) {
    logger.error(`Error en runSync: ${error.message}`);
  }
}

module.exports = { startSyncJob, stopSyncJob };
