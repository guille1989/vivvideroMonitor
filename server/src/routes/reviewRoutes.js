const express = require('express');
const { updateReviewTracking } = require('../controllers/reviewController');

const router = express.Router();

router.patch('/:reviewId/tracking', updateReviewTracking);

module.exports = router;
