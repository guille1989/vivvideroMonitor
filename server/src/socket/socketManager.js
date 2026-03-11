const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io = null;

/**
 * Inicializa Socket.IO en el servidor HTTP.
 *
 * @param {http.Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Cliente conectado: ${socket.id}`);

    // El cliente puede solicitar una sincronización manual
    socket.on('sync:request', async (data) => {
      const { syncBusinessReviews } = require('../services/syncService');
      const placeId = data?.placeId || process.env.PLACE_ID;
      logger.info(`Sync manual solicitada por ${socket.id} para ${placeId}`);
      try {
        await syncBusinessReviews(placeId);
      } catch (err) {
        logger.error(`Error en sync manual: ${err.message}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  logger.success('Socket.IO inicializado');
  return io;
}

/**
 * Retorna la instancia de io (para usarla en servicios).
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado. Llama a initSocket primero.');
  }
  return io;
}

module.exports = { initSocket, getIO };
