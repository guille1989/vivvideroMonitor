const Review = require('../models/Review');
const logger = require('../utils/logger');

const TRACKING_STATUSES = ['unmanaged', 'managed', 'in_follow_up', 'ignored', 'escalated'];

/**
 * PATCH /api/reviews/:reviewId/tracking
 * Actualiza el estado operativo y la nota interna de una review.
 */
async function updateReviewTracking(req, res) {
  try {
    const { reviewId } = req.params;
    const { trackingStatus, trackingNote } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review no encontrada' });
    }

    const nextStatus = typeof trackingStatus === 'string'
      ? trackingStatus.trim()
      : review.trackingStatus || 'unmanaged';
    const nextNote = typeof trackingNote === 'string'
      ? trackingNote.trim()
      : review.trackingNote || '';

    if (!TRACKING_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ error: 'trackingStatus invalido' });
    }

    const currentStatus = review.trackingStatus || 'unmanaged';
    const currentNote = review.trackingNote || '';
    const hasStatusChanged = currentStatus !== nextStatus;
    const hasNoteChanged = currentNote !== nextNote;

    if (!hasStatusChanged && !hasNoteChanged) {
      return res.json({ success: true, review });
    }

    const updatedAt = new Date();
    review.trackingStatus = nextStatus;
    review.trackingNote = nextNote;
    review.trackingUpdatedAt = updatedAt;
    review.trackingHistory = Array.isArray(review.trackingHistory) ? review.trackingHistory : [];
    review.trackingHistory.push({
      status: nextStatus,
      note: nextNote,
      createdAt: updatedAt,
    });
    review.trackingHistory = review.trackingHistory.slice(-50);

    await review.save();

    logger.info(`Tracking actualizado para review ${reviewId}: ${currentStatus} -> ${nextStatus}`);

    return res.json({
      success: true,
      review,
    });
  } catch (error) {
    logger.error(`updateReviewTracking error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  updateReviewTracking,
};
