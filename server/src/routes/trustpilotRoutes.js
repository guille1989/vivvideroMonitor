const express = require('express');
const router = express.Router();
const {
  getTrustpilotSummary,
  getTrustpilotReviews,
  getTrustpilotMetrics,
  triggerTrustpilotSync,
} = require('../controllers/trustpilotController');

// GET /api/trustpilot/summary
router.get('/summary', getTrustpilotSummary);

// GET /api/trustpilot/metrics
router.get('/metrics', getTrustpilotMetrics);

// GET /api/trustpilot/reviews
router.get('/reviews', getTrustpilotReviews);

// POST /api/trustpilot/sync
router.post('/sync', triggerTrustpilotSync);

module.exports = router;
