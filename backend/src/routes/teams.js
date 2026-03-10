/**
 * Teams and Players Routes
 */

const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

// Get all teams
router.get('/', teamController.getAllTeams);

// Get team by ID with players
router.get('/:id', teamController.getTeamById);

// Get all players for a team
router.get('/:id/players', teamController.getTeamPlayers);

// Get player by ID
router.get('/players/:playerId', teamController.getPlayerById);

module.exports = router;
