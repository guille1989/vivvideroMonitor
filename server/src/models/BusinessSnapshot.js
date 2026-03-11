const mongoose = require('mongoose');

/**
 * Modelo BusinessSnapshot
 * Guarda el estado más reciente del negocio (nombre, rating, total de reviews).
 * Se actualiza en cada sincronización.
 */
const businessSnapshotSchema = new mongoose.Schema(
  {
    placeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
    },
    currentRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    // Historial de ratings para detectar cambios
    ratingHistory: [
      {
        rating: Number,
        recordedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BusinessSnapshot', businessSnapshotSchema);
