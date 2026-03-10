/**
 * Match Routes
 */

const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');

// ============ Match Lifecycle ============

// Schedule a new match (creates without starting)
router.post('/schedule', matchController.scheduleMatch);

// Start a new match immediately
router.post('/start', matchController.startMatch);

// Get all matches
router.get('/', matchController.getAllMatches);

// Get matches by status
router.get('/status/:status', matchController.getMatchesByStatus);

// Start a scheduled match
router.post('/:matchId/start', matchController.startScheduledMatch);

// Delay a match (e.g., due to rain)
router.post('/:matchId/delay', matchController.delayMatch);

// Apply DLS method
router.post('/:matchId/dls', matchController.applyDLS);

// Abandon a match
router.post('/:matchId/abandon', matchController.abandonMatch);

// Declare no result
router.post('/:matchId/no-result', matchController.declareNoResult);

// Complete a match
router.post('/:matchId/complete', matchController.completeMatch);

// Get match details
router.get('/:matchId', matchController.getMatchDetails);

// ============ Match Actions ============

// Set toss result
router.post('/:matchId/toss', matchController.setTossResult);

// Initialize innings
router.post('/:matchId/innings/start', matchController.initializeInnings);

// Record a ball
router.post('/:matchId/ball', matchController.recordBall);

// Set new batsman
router.post('/:matchId/batsman', matchController.setNewBatsman);

// Set new bowler
router.post('/:matchId/bowler', matchController.setNewBowler);

// ============ Stats ============

// Get batsman stats for innings
router.get('/:matchId/innings/:inningsId/batsmen', matchController.getBatsmanStats);

// Get bowler stats for innings
router.get('/:matchId/innings/:inningsId/bowlers', matchController.getBowlerStats);

// Get fall of wickets
router.get('/:matchId/innings/:inningsId/wickets', matchController.getFallOfWickets);

// Get ball by ball data
router.get('/:matchId/innings/:inningsId/balls', matchController.getBallByBall);

module.exports = router;
