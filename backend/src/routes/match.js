/**
 * Match Routes
 */

const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');

// Start a new match
router.post('/start', matchController.startMatch);

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

// Get match details
router.get('/:matchId', matchController.getMatchDetails);

// Get all matches
router.get('/', matchController.getAllMatches);

// Get batsman stats for innings
router.get('/:matchId/innings/:inningsId/batsmen', matchController.getBatsmanStats);

// Get bowler stats for innings
router.get('/:matchId/innings/:inningsId/bowlers', matchController.getBowlerStats);

// Get fall of wickets
router.get('/:matchId/innings/:inningsId/wickets', matchController.getFallOfWickets);

// Get ball by ball data
router.get('/:matchId/innings/:inningsId/balls', matchController.getBallByBall);

module.exports = router;
