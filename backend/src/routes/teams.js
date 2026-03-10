/**
 * Teams and Players Routes
 */

const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

// ============ Teams ============

// Get all teams
router.get('/', teamController.getAllTeams);

// Create a new team
router.post('/', teamController.createTeam);

// Get team by ID with players
router.get('/:id', teamController.getTeamById);

// Update team
router.put('/:id', teamController.updateTeam);

// Delete team
router.delete('/:id', teamController.deleteTeam);

// ============ Players ============

// Get all players for a team
router.get('/:id/players', teamController.getTeamPlayers);

// Add multiple players to a team
router.post('/:teamId/players', teamController.addPlayersToTeam);

// Create a single player for a team
router.post('/:teamId/players/create', teamController.createPlayer);

// Get player by ID
router.get('/players/:playerId', teamController.getPlayerById);

// Update player
router.put('/players/:playerId', teamController.updatePlayer);

// Delete player
router.delete('/players/:playerId', teamController.deletePlayer);

module.exports = router;
