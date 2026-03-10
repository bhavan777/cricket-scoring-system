/**
 * Tournament Routes
 */

const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');

// ============ Tournament CRUD ============

// Create a new tournament
router.post('/', tournamentController.createTournament);

// Get all tournaments
router.get('/', tournamentController.getAllTournaments);

// Get tournament by ID
router.get('/:id', tournamentController.getTournamentById);

// Delete tournament
router.delete('/:id', tournamentController.deleteTournament);

// ============ Tournament Teams ============

// Add teams to tournament
router.post('/:tournamentId/teams', tournamentController.addTeamsToTournament);

// Get tournament teams
router.get('/:tournamentId/teams', tournamentController.getTournamentTeams);

// Remove team from tournament
router.delete('/:tournamentId/teams/:teamId', tournamentController.removeTeamFromTournament);

// ============ Fixtures ============

// Generate fixtures for tournament
router.post('/:tournamentId/fixtures/generate', tournamentController.generateFixtures);

// Create a single fixture
router.post('/fixtures', tournamentController.createFixture);

// Get tournament fixtures
router.get('/:tournamentId/fixtures', tournamentController.getTournamentFixtures);

// Link match to fixture
router.post('/fixtures/:fixtureId/link-match', tournamentController.linkMatchToFixture);

// ============ Points Table ============

// Get points table
router.get('/:tournamentId/points', tournamentController.getPointsTable);

// Update points after match
router.post('/:tournamentId/points/update', tournamentController.updatePointsAfterMatch);

// ============ Stadiums ============

// Create a stadium
router.post('/stadiums', tournamentController.createStadium);

// Get all stadiums
router.get('/stadiums/all', tournamentController.getAllStadiums);

module.exports = router;
