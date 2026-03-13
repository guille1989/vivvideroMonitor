require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/database');
const { initSocket } = require('./socket/socketManager');
const { startSyncJob } = require('./jobs/syncJob');

const PORT = process.env.PORT || 3002;

async function bootstrap() {
  try {
    // 1. Conectar a MongoDB
    await connectDB();

    // 2. Crear servidor HTTP
    const server = http.createServer(app);

    // 3. Inicializar Socket.IO
    initSocket(server);

    // 4. Arrancar job de sincronización periódica
    startSyncJob();

    // 5. Levantar servidor
    server.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📡 Socket.IO listo`);
      console.log(`🔄 Sincronización automática cada ${process.env.SYNC_INTERVAL_MS / 1000}s`);
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

bootstrap();
