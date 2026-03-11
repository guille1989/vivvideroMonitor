const mongoose = require('mongoose');

/**
 * Conecta a MongoDB usando la URI del .env
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/google-reviews-monitor';

  try {
    await mongoose.connect(uri);
    console.log(`✅ MongoDB conectado: ${uri}`);

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado. Intentando reconectar...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconectado');
    });

  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    throw error;
  }
}

module.exports = { connectDB };
