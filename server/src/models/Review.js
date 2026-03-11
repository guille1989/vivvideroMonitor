const mongoose = require('mongoose');

/**
 * Modelo Review
 * Almacena cada reseña obtenida de Google Places API.
 * reviewHash garantiza deduplicación cuando no hay reviewId.
 */
const reviewSchema = new mongoose.Schema(
  {
    placeId: {
      type: String,
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorPhotoUrl: {
      type: String,
      default: null,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    text: {
      type: String,
      default: '',
    },
    relativeTimeDescription: {
      type: String,
      default: null,
    },
    reviewTimestamp: {
      type: Date,
      default: null,
    },
    language: {
      type: String,
      default: null,
    },
    // Hash único: author + fecha + texto (para deduplicación)
    reviewHash: {
      type: String,
      required: true,
      unique: true,
    },
    // Marcador de reseña recién detectada
    isNew: {
      type: Boolean,
      default: true,
    },
    // Reseña negativa (rating <= 2)
    isNegative: {
      type: Boolean,
      default: false,
    },
    // Cuándo fue guardada/sincronizada
    syncedAt: {
      type: Date,
      default: Date.now,
    },
    // Estado de la reseña con respecto a la última visibilidad en Google
    status: {
      type: String,
      enum: ['active', 'removed'],
      default: 'active',
      index: true,
    },
    // Última vez que la reseña apareció en la respuesta de Google Places
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    // Primera vez que dejó de verse en Google durante los ciclos de sync
    missingSince: {
      type: Date,
      default: null,
    },
    // Cantidad de ciclos consecutivos sin aparecer
    missingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Índice compuesto para consultas frecuentes
reviewSchema.index({ placeId: 1, rating: 1 });
reviewSchema.index({ placeId: 1, isNew: 1 });
reviewSchema.index({ placeId: 1, isNegative: 1 });
reviewSchema.index({ placeId: 1, syncedAt: -1 });
reviewSchema.index({ placeId: 1, status: 1 });

module.exports = mongoose.model('Review', reviewSchema);
