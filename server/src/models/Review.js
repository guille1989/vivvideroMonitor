const mongoose = require('mongoose');

const TRACKING_STATUSES = ['unmanaged', 'managed', 'in_follow_up', 'ignored', 'escalated'];

/**
 * Modelo Review
 * Almacena cada resena obtenida de Google Places API o Trustpilot.
 * reviewHash garantiza deduplicacion cuando no hay reviewId.
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
    // Hash unico: author + fecha + texto (para deduplicacion)
    reviewHash: {
      type: String,
      required: true,
      unique: true,
    },
    // Marcador de resena recien detectada
    isNew: {
      type: Boolean,
      default: true,
    },
    // Resena negativa (rating <= 2)
    isNegative: {
      type: Boolean,
      default: false,
    },
    // Cuando fue guardada/sincronizada
    syncedAt: {
      type: Date,
      default: Date.now,
    },
    // Estado operativo interno para seguimiento manual
    trackingStatus: {
      type: String,
      enum: TRACKING_STATUSES,
      default: 'unmanaged',
      index: true,
    },
    // Ultima nota interna registrada por el equipo
    trackingNote: {
      type: String,
      default: '',
      maxlength: 1500,
    },
    trackingUpdatedAt: {
      type: Date,
      default: null,
    },
    trackingHistory: [
      {
        status: {
          type: String,
          enum: TRACKING_STATUSES,
          required: true,
        },
        note: {
          type: String,
          default: '',
          maxlength: 1500,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Estado de la resena con respecto a la ultima visibilidad en la fuente
    status: {
      type: String,
      enum: ['active', 'removed'],
      default: 'active',
      index: true,
    },
    // Ultima vez que la resena aparecio en la respuesta de la fuente
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    // Primera vez que dejo de verse durante los ciclos de sync
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

// Indices compuestos para consultas frecuentes
reviewSchema.index({ placeId: 1, rating: 1 });
reviewSchema.index({ placeId: 1, isNew: 1 });
reviewSchema.index({ placeId: 1, isNegative: 1 });
reviewSchema.index({ placeId: 1, syncedAt: -1 });
reviewSchema.index({ placeId: 1, status: 1 });
reviewSchema.index({ placeId: 1, trackingStatus: 1 });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
module.exports.TRACKING_STATUSES = TRACKING_STATUSES;
