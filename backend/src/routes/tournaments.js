/**
 * Tournament Routes
 */

const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');

// ============ Static Routes First (before dynamic :id routes) ============

// Create a stadium
router.post('/stadiums', tournamentController.createStadium);

// Get all stadiums
router.get('/stadiums/all', tournamentController.getAllStadiums);

// Create a single fixture
router.post('/fixtures', tournamentController.createFixture);

// Link match to fixture
router.post('/fixtures/:fixtureId/link-match', tournamentController.linkMatchToFixture);

// Record knockout result
router.post('/fixtures/:fixtureId/result', tournamentController.recordKnockoutResult);

// ============ Super Over Routes ============

// Start a super over for a match
router.post('/super-over/match/:matchId/start', tournamentController.startSuperOver);

// Record a ball in super over
router.post('/super-over/:superOverId/ball', tournamentController.recordSuperOverBall);

// Get super over result
router.get('/super-over/match/:matchId', tournamentController.getSuperOverResult);

// Determine super over winner
router.get('/super-over/match/:matchId/winner', tournamentController.determineSuperOverWinner);

// Complete super over match
router.post('/super-over/match/:matchId/complete', tournamentController.completeSuperOverMatch);

// ============ Tournament CRUD ============

// Create a new tournament
router.post('/', tournamentController.createTournament);

// Get all tournaments
router.get('/', tournamentController.getAllTournaments);

// Get tournament by ID
router.get('/:id', tournamentController.getTournamentById);

// Update tournament
router.put('/:id', tournamentController.updateTournament);

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

// Get tournament fixtures
router.get('/:tournamentId/fixtures', tournamentController.getTournamentFixtures);

// ============ Points Table ============

// Get points table
router.get('/:tournamentId/points', tournamentController.getPointsTable);

// Update points after match
router.post('/:tournamentId/points/update', tournamentController.updatePointsAfterMatch);

// Get qualified teams for knockouts
router.get('/:tournamentId/qualified', tournamentController.getQualifiedTeams);

// Update knockout fixtures with qualified teams
router.post('/:tournamentId/knockouts/update', tournamentController.updateKnockoutFixtures);

module.exports = router;
