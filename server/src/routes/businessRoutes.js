const express = require('express');
const router = express.Router();
const {
  getSummary,
  getReviews,
  getMetrics,
  triggerSync,
} = require('../controllers/businessController');

// GET /api/business/:placeId/summary
router.get('/:placeId/summary', getSummary);

// GET /api/business/:placeId/reviews
router.get('/:placeId/reviews', getReviews);

// GET /api/business/:placeId/metrics
router.get('/:placeId/metrics', getMetrics);

// POST /api/business/:placeId/sync
router.post('/:placeId/sync', triggerSync);

module.exports = router;
