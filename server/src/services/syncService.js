const dayjs = require('dayjs');
const Review = require('../models/Review');
const BusinessSnapshot = require('../models/BusinessSnapshot');
const { fetchPlaceDetails } = require('./googlePlacesService');
const { generateReviewHash } = require('../utils/hashUtils');
const logger = require('../utils/logger');
const { getIO } = require('../socket/socketManager');

const DEFAULT_REVIEW_REMOVAL_GRACE_CYCLES = 3;

function getRemovalGraceCycles() {
  const parsed = parseInt(process.env.REVIEW_REMOVAL_GRACE_CYCLES, 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_REVIEW_REMOVAL_GRACE_CYCLES;
  return parsed;
}

/**
 * Sincroniza las reviews de un negocio con la base de datos.
 * Detecta nuevas reviews, cambios de rating, reviews negativas y reseñas removidas.
 * Emite eventos Socket.IO para cada evento detectado.
 *
 * @param {string} placeId
 * @returns {Promise<{newCount, negativeCount, removedCount, ratingChanged, currentRating}>}
 */
async function syncBusinessReviews(placeId) {
  const io = getIO();
  const syncStartedAt = new Date();
  const removalGraceCycles = getRemovalGraceCycles();

  // Emitir inicio de sincronización
  io.emit('sync:started', { placeId, startedAt: syncStartedAt.toISOString() });
  logger.info(`🔄 Iniciando sincronización para ${placeId}`);

  try {
    // 1. Obtener datos frescos de Google Places API
    const placeData = await fetchPlaceDetails(placeId);
    const { name, rating, userRatingsTotal, reviews = [] } = placeData;

    // 2. Obtener snapshot anterior para detectar cambio de rating
    const previousSnapshot = await BusinessSnapshot.findOne({ placeId });
    const previousRating = previousSnapshot?.currentRating || null;

    // 3. Procesar cada review
    const newReviews = [];
    const negativeReviews = [];
    const removedReviews = [];
    const seenHashes = new Set();

    for (const googleReview of reviews) {
      const reviewTimestamp = googleReview.time
        ? dayjs.unix(googleReview.time).toDate()
        : null;
      const stableHash = generateReviewHash(
        googleReview.author_name,
        googleReview.time || googleReview.relative_time_description || '',
        googleReview.text
      );
      const legacyHash = generateReviewHash(
        googleReview.author_name,
        googleReview.relative_time_description,
        googleReview.text
      );
      seenHashes.add(stableHash);
      const isNegative = googleReview.rating <= 2;

      // Verificar si ya existe en la BD para este negocio
      const existing = await Review.findOne({
        placeId,
        reviewHash: { $in: Array.from(new Set([stableHash, legacyHash])) },
      });

      if (!existing) {
        const newReview = await Review.create({
          placeId,
          authorName: googleReview.author_name,
          authorPhotoUrl: googleReview.profile_photo_url || null,
          rating: googleReview.rating,
          text: googleReview.text || '',
          relativeTimeDescription: googleReview.relative_time_description || null,
          reviewTimestamp,
          language: googleReview.language || null,
          reviewHash: stableHash,
          isNew: true,
          isNegative,
          syncedAt: syncStartedAt,
          status: 'active',
          lastSeenAt: syncStartedAt,
          missingSince: null,
          missingCount: 0,
        });

        newReviews.push(newReview);

        // Emitir evento de nueva review
        io.emit('review:new', {
          review: newReview.toObject(),
          businessName: name,
        });
        logger.success(`Nueva review detectada de: ${googleReview.author_name} (${googleReview.rating}★)`);

        if (isNegative) {
          negativeReviews.push(newReview);
          // Emitir evento de review negativa
          io.emit('review:negative', {
            review: newReview.toObject(),
            businessName: name,
          });
          logger.warn(`Review negativa de: ${googleReview.author_name} (${googleReview.rating}★)`);
        }
        continue;
      }

      const wasNegative = existing.isNegative;

      // Actualizar reseña existente y "reactivarla" si estaba marcada como removida
      existing.authorName = googleReview.author_name;
      existing.authorPhotoUrl = googleReview.profile_photo_url || null;
      existing.rating = googleReview.rating;
      existing.text = googleReview.text || '';
      existing.relativeTimeDescription = googleReview.relative_time_description || null;
      existing.reviewTimestamp = reviewTimestamp;
      existing.language = googleReview.language || null;
      existing.reviewHash = stableHash;
      existing.isNegative = isNegative;
      existing.status = 'active';
      existing.syncedAt = syncStartedAt;
      existing.lastSeenAt = syncStartedAt;
      existing.missingSince = null;
      existing.missingCount = 0;
      await existing.save();

      if (!wasNegative && isNegative) {
        negativeReviews.push(existing);
        io.emit('review:negative', {
          review: existing.toObject(),
          businessName: name,
        });
        logger.warn(`Review ahora negativa: ${googleReview.author_name} (${googleReview.rating}★)`);
      }
    }

    // 4. Detectar reseñas ausentes de forma consecutiva para marcarlas como removidas
    const seenHashesArray = Array.from(seenHashes);
    const missingFilter = {
      placeId,
      status: { $ne: 'removed' },
      reviewHash: seenHashesArray.length > 0 ? { $nin: seenHashesArray } : { $exists: true },
    };
    const missingCandidates = await Review.find(missingFilter);

    for (const review of missingCandidates) {
      review.missingSince = review.missingSince || syncStartedAt;
      review.missingCount = (review.missingCount || 0) + 1;

      if (review.missingCount >= removalGraceCycles) {
        review.status = 'removed';
        removedReviews.push(review);
      }

      await review.save();
    }

    for (const removedReview of removedReviews) {
      io.emit('review:removed', {
        review: removedReview.toObject(),
        businessName: name,
      });
      logger.warn(`Review removida detectada: ${removedReview.authorName} (${removedReview.rating}★)`);
    }

    // 5. Detectar cambio de rating
    const ratingChanged = previousRating !== null && previousRating !== rating;

    if (ratingChanged) {
      io.emit('business:rating_changed', {
        placeId,
        previousRating,
        currentRating: rating,
        businessName: name,
      });
      logger.info(`Rating cambió: ${previousRating} → ${rating}`);
    }

    // 6. Actualizar snapshot del negocio
    await BusinessSnapshot.findOneAndUpdate(
      { placeId },
      {
        placeId,
        businessName: name,
        currentRating: rating,
        totalReviews: userRatingsTotal,
        lastSyncedAt: syncStartedAt,
        // Agregar al historial de ratings
        $push: {
          ratingHistory: {
            $each: [{ rating, recordedAt: syncStartedAt }],
            $slice: -100, // Mantener solo los últimos 100
          },
        },
      },
      { upsert: true, new: true }
    );

    const result = {
      newCount: newReviews.length,
      negativeCount: negativeReviews.length,
      removedCount: removedReviews.length,
      ratingChanged,
      currentRating: rating,
      totalReviews: userRatingsTotal,
      businessName: name,
    };

    // Emitir fin de sincronización
    io.emit('sync:finished', {
      placeId,
      finishedAt: new Date().toISOString(),
      ...result,
    });

    logger.success(
      `Sync completada → Nuevas: ${newReviews.length} | Negativas: ${negativeReviews.length} | Removidas: ${removedReviews.length} | Rating: ${rating}`
    );

    return result;

  } catch (error) {
    // Emitir error
    io.emit('sync:error', {
      placeId,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    logger.error(`Error en sincronización: ${error.message}`);
    throw error;
  }
}

/**
 * Marca todas las reviews de un placeId como "no nuevas" (vistas).
 */
async function markReviewsAsSeen(placeId) {
  await Review.updateMany(
    { placeId, isNew: true, status: { $ne: 'removed' } },
    { isNew: false }
  );
}

module.exports = { syncBusinessReviews, markReviewsAsSeen };
