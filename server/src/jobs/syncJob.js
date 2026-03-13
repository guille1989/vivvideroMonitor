const { syncBusinessReviews } = require('../services/syncService');
const { syncTrustpilotReviews, getTrustpilotProfileUrl } = require('../services/trustpilotSyncService');
const logger = require('../utils/logger');

let syncInterval = null;
let trustpilotSyncInterval = null;

/**
 * Inicia el job de sincronización periódica.
 * Por defecto se ejecuta cada 60 segundos (configurable via SYNC_INTERVAL_MS).
 */
function startSyncJob() {
  const placeId = process.env.PLACE_ID;
  const intervalMs = parseInt(process.env.SYNC_INTERVAL_MS, 10) || 60000;
  const trustpilotProfileUrl = getTrustpilotProfileUrl();
  const trustpilotIntervalMs = parseInt(process.env.TRUSTPILOT_SYNC_INTERVAL_MS, 10) || intervalMs;

  if (!placeId) {
    logger.warn('PLACE_ID no configurado. El job de sync no se iniciará.');
  } else {
    logger.info(`Job de sync iniciado. Intervalo: ${intervalMs / 1000}s | PlaceId: ${placeId}`);
    runSync(placeId);
    syncInterval = setInterval(() => {
      runSync(placeId);
    }, intervalMs);
  }

  if (!trustpilotProfileUrl) {
    logger.warn('TRUSTPILOT_PROFILE_URL no configurado. El job de Trustpilot no se iniciará.');
    return;
  }

  logger.info(`Job Trustpilot iniciado. Intervalo: ${trustpilotIntervalMs / 1000}s | URL: ${trustpilotProfileUrl}`);
  runTrustpilotSync();
  trustpilotSyncInterval = setInterval(() => {
    runTrustpilotSync();
  }, trustpilotIntervalMs);
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

  if (trustpilotSyncInterval) {
    clearInterval(trustpilotSyncInterval);
    trustpilotSyncInterval = null;
    logger.info('Job de sync Trustpilot detenido.');
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

async function runTrustpilotSync() {
  try {
    await syncTrustpilotReviews();
  } catch (error) {
    logger.error(`Error en runTrustpilotSync: ${error.message}`);
  }
}

module.exports = { startSyncJob, stopSyncJob };
