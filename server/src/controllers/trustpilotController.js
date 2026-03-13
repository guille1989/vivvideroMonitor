const Review = require('../models/Review');
const BusinessSnapshot = require('../models/BusinessSnapshot');
const { getTrustpilotPlaceId, syncTrustpilotReviews } = require('../services/trustpilotSyncService');
const logger = require('../utils/logger');

const TRACKING_STATUSES = Review.TRACKING_STATUSES || ['unmanaged', 'managed', 'in_follow_up', 'ignored', 'escalated'];

async function getTrackingCounts(placeId) {
  const counts = TRACKING_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  const rows = await Review.aggregate([
    { $match: { placeId, status: { $ne: 'removed' } } },
    {
      $group: {
        _id: { $ifNull: ['$trackingStatus', 'unmanaged'] },
        count: { $sum: 1 },
      },
    },
  ]);

  for (const row of rows) {
    if (counts[row._id] !== undefined) {
      counts[row._id] = row.count;
    }
  }

  return counts;
}

/**
 * GET /api/trustpilot/summary
 * Retorna resumen del negocio Trustpilot.
 */
async function getTrustpilotSummary(req, res) {
  try {
    const placeId = getTrustpilotPlaceId();
    const snapshot = await BusinessSnapshot.findOne({ placeId });

    if (!snapshot) {
      return res.status(404).json({ error: 'Trustpilot data unavailable — run a sync first' });
    }

    const totalInDB = await Review.countDocuments({ placeId, status: { $ne: 'removed' } });
    const newCount = await Review.countDocuments({ placeId, isNew: true, status: { $ne: 'removed' } });
    const negativeCount = await Review.countDocuments({ placeId, isNegative: true, status: { $ne: 'removed' } });
    const removedCount = await Review.countDocuments({ placeId, status: 'removed' });
    const trackingCounts = await getTrackingCounts(placeId);

    res.json({
      placeId: snapshot.placeId,
      businessName: snapshot.businessName,
      currentRating: snapshot.currentRating,
      totalReviews: snapshot.totalReviews,
      totalInDB,
      lastSyncedAt: snapshot.lastSyncedAt,
      newReviewsCount: newCount,
      negativeReviewsCount: negativeCount,
      negativeCount,
      removedReviewsCount: removedCount,
      trackingCounts,
    });
  } catch (error) {
    logger.error(`getTrustpilotSummary error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/trustpilot/reviews
 * Lista reviews de Trustpilot con filtros opcionales.
 */
async function getTrustpilotReviews(req, res) {
  try {
    const placeId = getTrustpilotPlaceId();
    const {
      rating,
      onlyNew,
      onlyNegative,
      includeRemoved,
      onlyRemoved,
      trackingStatus,
      search,
      from,
      to,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { placeId };

    if (rating) filter.rating = Number(rating);
    if (onlyNew === 'true') filter.isNew = true;
    if (onlyNegative === 'true') filter.isNegative = true;
    if (trackingStatus) {
      if (!TRACKING_STATUSES.includes(trackingStatus)) {
        return res.status(400).json({ error: 'trackingStatus invalido' });
      }
      filter.trackingStatus = trackingStatus === 'unmanaged'
        ? { $in: ['unmanaged', null] }
        : trackingStatus;
    }
    if (onlyRemoved === 'true') {
      filter.status = 'removed';
    } else if (includeRemoved !== 'true') {
      filter.status = { $ne: 'removed' };
    }

    if (search) {
      filter.$or = [
        { text: { $regex: search, $options: 'i' } },
        { authorName: { $regex: search, $options: 'i' } },
      ];
    }

    if (from || to) {
      filter.syncedAt = {};
      if (from) filter.syncedAt.$gte = new Date(from);
      if (to) filter.syncedAt.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Review.countDocuments(filter);
    const reviews = await Review.find(filter)
      .sort({ syncedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
      reviews,
    });
  } catch (error) {
    logger.error(`getTrustpilotReviews error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/trustpilot/metrics
 * Retorna distribución por estrellas, historial de ratings y conteo de negativas.
 */
async function getTrustpilotMetrics(req, res) {
  try {
    const placeId = getTrustpilotPlaceId();
    const activeFilter = { placeId, status: { $ne: 'removed' } };

    const starDistribution = await Review.aggregate([
      { $match: activeFilter },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const reviewsByDay = await Review.aggregate([
      { $match: { ...activeFilter, syncedAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$syncedAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const negativeCount = await Review.countDocuments({ ...activeFilter, isNegative: true });
    const snapshot = await BusinessSnapshot.findOne({ placeId }, 'ratingHistory');

    res.json({
      starDistribution: starDistribution.map((d) => ({
        stars: d._id,
        count: d.count,
      })),
      reviewsByDay: reviewsByDay.map((d) => ({
        date: d._id,
        count: d.count,
      })),
      negativeCount,
      ratingHistory: snapshot?.ratingHistory?.slice(-30) || [],
    });
  } catch (error) {
    logger.error(`getTrustpilotMetrics error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/trustpilot/sync
 * Dispara sincronización manual de Trustpilot.
 */
async function triggerTrustpilotSync(req, res) {
  try {
    const result = await syncTrustpilotReviews();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`triggerTrustpilotSync error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getTrustpilotSummary,
  getTrustpilotReviews,
  getTrustpilotMetrics,
  triggerTrustpilotSync,
};
