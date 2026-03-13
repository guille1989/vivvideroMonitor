const dayjs = require('dayjs');
const Review = require('../models/Review');
const BusinessSnapshot = require('../models/BusinessSnapshot');
const { scrapeTrustpilot } = require('./trustpilotScraperService');
const { generateReviewHash } = require('../utils/hashUtils');
const logger = require('../utils/logger');

const DEFAULT_REVIEW_REMOVAL_GRACE_CYCLES = 3;
const DEFAULT_TRUSTPILOT_PLACE_ID = 'trustpilot:vivvidero.com';
const DEFAULT_TRUSTPILOT_PROFILE_URL = 'https://uk.trustpilot.com/review/vivvidero.com';

function getRemovalGraceCycles() {
  const parsed = parseInt(process.env.REVIEW_REMOVAL_GRACE_CYCLES, 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_REVIEW_REMOVAL_GRACE_CYCLES;
  return parsed;
}

function getTrustpilotPlaceId() {
  return process.env.TRUSTPILOT_PLACE_ID || DEFAULT_TRUSTPILOT_PLACE_ID;
}

function getTrustpilotProfileUrl() {
  return process.env.TRUSTPILOT_PROFILE_URL || DEFAULT_TRUSTPILOT_PROFILE_URL;
}

/**
 * Sincroniza reseñas de Trustpilot con la base de datos.
 *
 * @returns {Promise<{newCount, negativeCount, removedCount, ratingChanged, currentRating, totalReviews, businessName}>}
 */
async function syncTrustpilotReviews() {
  const syncStartedAt = new Date();
  const removalGraceCycles = getRemovalGraceCycles();
  const placeId = getTrustpilotPlaceId();
  const profileUrl = getTrustpilotProfileUrl();

  logger.info(`🔄 Iniciando sincronización Trustpilot para ${profileUrl}`);

  const { businessData, reviews } = await scrapeTrustpilot(profileUrl);
  const detectedCount = reviews.length;
  const previousSnapshot = await BusinessSnapshot.findOne({ placeId });
  const previousRating = previousSnapshot?.currentRating || null;

  const seenHashes = new Set();
  const newReviews = [];
  const negativeReviews = [];
  const removedReviews = [];

  for (const trustpilotReview of reviews) {
    const parsedTimestamp = trustpilotReview.reviewTimestamp
      ? dayjs(trustpilotReview.reviewTimestamp).toDate()
      : null;
    const stableBaseHash = generateReviewHash(
      trustpilotReview.authorName,
      trustpilotReview.reviewTimestamp || trustpilotReview.relativeTimeDescription || '',
      trustpilotReview.text || ''
    );
    const legacyBaseHash = generateReviewHash(
      trustpilotReview.authorName,
      trustpilotReview.relativeTimeDescription || trustpilotReview.reviewTimestamp || '',
      trustpilotReview.text || ''
    );
    const reviewHash = `${placeId}:${stableBaseHash}`;
    const legacyReviewHash = `${placeId}:${legacyBaseHash}`;
    seenHashes.add(reviewHash);

    const isNegative = Number(trustpilotReview.rating) <= 2;

    const existing = await Review.findOne({
      placeId,
      reviewHash: { $in: Array.from(new Set([reviewHash, legacyReviewHash])) },
    });

    if (!existing) {
      const newReview = await Review.create({
        placeId,
        authorName: trustpilotReview.authorName,
        authorPhotoUrl: trustpilotReview.authorPhotoUrl || null,
        rating: Number(trustpilotReview.rating) || 0,
        text: trustpilotReview.text || '',
        relativeTimeDescription: trustpilotReview.relativeTimeDescription || null,
        reviewTimestamp: parsedTimestamp,
        language: null,
        reviewHash,
        isNew: true,
        isNegative,
        syncedAt: syncStartedAt,
        status: 'active',
        lastSeenAt: syncStartedAt,
        missingSince: null,
        missingCount: 0,
      });

      newReviews.push(newReview);
      if (isNegative) negativeReviews.push(newReview);
      continue;
    }

    const wasNegative = existing.isNegative;

    existing.authorName = trustpilotReview.authorName;
    existing.authorPhotoUrl = trustpilotReview.authorPhotoUrl || null;
    existing.rating = Number(trustpilotReview.rating) || existing.rating;
    existing.text = trustpilotReview.text || '';
    existing.relativeTimeDescription = trustpilotReview.relativeTimeDescription || null;
    existing.reviewTimestamp = parsedTimestamp;
    existing.reviewHash = reviewHash;
    existing.isNegative = isNegative;
    existing.status = 'active';
    existing.syncedAt = syncStartedAt;
    existing.lastSeenAt = syncStartedAt;
    existing.missingSince = null;
    existing.missingCount = 0;
    await existing.save();

    if (!wasNegative && isNegative) {
      negativeReviews.push(existing);
    }
  }

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

  const rating = Number(businessData?.rating) || 0;
  const totalReviews = Number(businessData?.totalReviews) || 0;
  const businessName = businessData?.businessName || 'Trustpilot';
  const ratingChanged = previousRating !== null && previousRating !== rating;

  await BusinessSnapshot.findOneAndUpdate(
    { placeId },
    {
      placeId,
      businessName,
      currentRating: rating,
      totalReviews,
      lastSyncedAt: syncStartedAt,
      // Agregar al historial de ratings
      $push: {
        ratingHistory: {
          $each: [{ rating, recordedAt: syncStartedAt }],
          $slice: -100,
        },
      },
    },
    { upsert: true, new: true }
  );

  logger.success(
    `Trustpilot sync completada → Detectadas: ${detectedCount} | Nuevas: ${newReviews.length} | Negativas: ${negativeReviews.length} | Removidas: ${removedReviews.length} | Rating: ${rating}`
  );

  return {
    detectedCount,
    newCount: newReviews.length,
    negativeCount: negativeReviews.length,
    removedCount: removedReviews.length,
    ratingChanged,
    currentRating: rating,
    totalReviews,
    businessName,
  };
}

module.exports = {
  getTrustpilotPlaceId,
  getTrustpilotProfileUrl,
  syncTrustpilotReviews,
};
