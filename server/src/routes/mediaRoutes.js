const express = require('express');
const { proxyAvatar } = require('../controllers/mediaController');

const router = express.Router();

router.get('/avatar', proxyAvatar);

module.exports = router;
