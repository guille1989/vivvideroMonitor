const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/health
router.get('/', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }[dbState] || 'unknown';
  const syncIntervalMs = parseInt(process.env.SYNC_INTERVAL_MS, 10) || 60000;
  const trustpilotSyncIntervalMs = parseInt(process.env.TRUSTPILOT_SYNC_INTERVAL_MS, 10) || syncIntervalMs;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    uptime: Math.floor(process.uptime()),
    syncIntervalMs,
    trustpilotSyncIntervalMs,
  });
});

module.exports = router;
