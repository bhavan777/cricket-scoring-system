/**
 * Live SSE Routes for real-time updates
 */

const express = require('express');
const router = express.Router();
const liveController = require('../controllers/liveController');

// SSE endpoint for live match updates
router.get('/:matchId/events', liveController.handleLiveEvents);

// Get live match summary (simplified JSON for UI)
router.get('/:matchId/summary', liveController.getMatchSummary);

// Get player stats across all matches
router.get('/player/:playerId/stats', liveController.getPlayerStats);

module.exports = router;
