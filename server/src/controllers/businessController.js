const Review = require('../models/Review');
const BusinessSnapshot = require('../models/BusinessSnapshot');
const { syncBusinessReviews } = require('../services/syncService');
const logger = require('../utils/logger');

/**
 * GET /api/business/:placeId/summary
 * Retorna el snapshot actual del negocio.
 */
async function getSummary(req, res) {
  try {
    const { placeId } = req.params;
    const snapshot = await BusinessSnapshot.findOne({ placeId });

    if (!snapshot) {
      return res.status(404).json({ error: 'Negocio no encontrado. Ejecuta una sincronización primero.' });
    }

    const newCount = await Review.countDocuments({ placeId, isNew: true, status: { $ne: 'removed' } });
    const negativeCount = await Review.countDocuments({ placeId, isNegative: true, status: { $ne: 'removed' } });
    const removedCount = await Review.countDocuments({ placeId, status: 'removed' });

    res.json({
      placeId: snapshot.placeId,
      businessName: snapshot.businessName,
      currentRating: snapshot.currentRating,
      totalReviews: snapshot.totalReviews,
      lastSyncedAt: snapshot.lastSyncedAt,
      newReviewsCount: newCount,
      negativeReviewsCount: negativeCount,
      removedReviewsCount: removedCount,
    });
  } catch (error) {
    logger.error(`getSummary error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/business/:placeId/reviews
 * Lista reviews con filtros opcionales:
 *   ?rating=5  (1-5)
 *   ?onlyNew=true
 *   ?onlyNegative=true
 *   ?includeRemoved=true
 *   ?onlyRemoved=true
 *   ?search=texto
 *   ?from=2024-01-01&to=2024-12-31
 *   ?page=1&limit=20
 */
async function getReviews(req, res) {
  try {
    const { placeId } = req.params;
    const {
      rating,
      onlyNew,
      onlyNegative,
      includeRemoved,
      onlyRemoved,
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
    logger.error(`getReviews error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/business/:placeId/metrics
 * Retorna distribución por estrellas, historial de ratings y conteo de negativas.
 */
async function getMetrics(req, res) {
  try {
    const { placeId } = req.params;
    const activeFilter = { placeId, status: { $ne: 'removed' } };

    // Distribución por estrellas
    const starDistribution = await Review.aggregate([
      { $match: activeFilter },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Reviews detectadas por día (últimos 30 días)
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

    // Conteo de negativas
    const negativeCount = await Review.countDocuments({ ...activeFilter, isNegative: true });

    // Historial de rating del snapshot
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
    logger.error(`getMetrics error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/business/:placeId/sync
 * Dispara una sincronización manual.
 */
async function triggerSync(req, res) {
  try {
    const { placeId } = req.params;
    const result = await syncBusinessReviews(placeId);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`triggerSync error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getSummary, getReviews, getMetrics, triggerSync };
