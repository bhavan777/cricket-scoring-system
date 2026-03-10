/**
 * Cricket Scoring Backend - Main Entry Point
 * T20 Match Scoring System for Official Scorers
 */

const express = require('express');
const cors = require('cors');
const { initDatabase, seedData } = require('./database');

// Initialize database
initDatabase();
seedData();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/teams', require('./routes/teams'));
app.use('/api/match', require('./routes/match'));
app.use('/api/live', require('./routes/live'));
app.use('/api/tournaments', require('./routes/tournaments'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'Cricket Scoring API',
    version: '3.0.0',
    endpoints: {
      teams: {
        'GET /api/teams': 'Get all teams',
        'POST /api/teams': 'Create a new team (with optional players)',
        'GET /api/teams/:id': 'Get team by ID with players',
        'PUT /api/teams/:id': 'Update team',
        'DELETE /api/teams/:id': 'Delete team (and its players)',
        'GET /api/teams/:id/players': 'Get players for a team',
        'POST /api/teams/:teamId/players': 'Add multiple players to a team',
        'POST /api/teams/:teamId/players/create': 'Create a single player',
        'PUT /api/teams/players/:playerId': 'Update player',
        'DELETE /api/teams/players/:playerId': 'Delete player',
        'GET /api/teams/players/:playerId': 'Get player by ID'
      },
      match: {
        'POST /api/match/start': 'Start a new match',
        'POST /api/match/:matchId/toss': 'Set toss result',
        'POST /api/match/:matchId/innings/start': 'Initialize innings',
        'POST /api/match/:matchId/ball': 'Record a ball',
        'POST /api/match/:matchId/batsman': 'Set new batsman',
        'POST /api/match/:matchId/bowler': 'Set new bowler',
        'GET /api/match/:matchId': 'Get match details',
        'GET /api/match': 'Get all matches'
      },
      live: {
        'GET /api/live/:matchId/events': 'SSE endpoint for live updates',
        'GET /api/live/:matchId/summary': 'Get match summary for UI'
      },
      stats: {
        'GET /api/match/:matchId/innings/:inningsId/batsmen': 'Get batsman stats',
        'GET /api/match/:matchId/innings/:inningsId/bowlers': 'Get bowler stats',
        'GET /api/match/:matchId/innings/:inningsId/wickets': 'Get fall of wickets',
        'GET /api/match/:matchId/innings/:inningsId/balls': 'Get ball by ball data'
      },
      tournaments: {
        'POST /api/tournaments': 'Create a new tournament',
        'GET /api/tournaments': 'Get all tournaments',
        'GET /api/tournaments/:id': 'Get tournament by ID',
        'DELETE /api/tournaments/:id': 'Delete tournament',
        'POST /api/tournaments/:tournamentId/teams': 'Add teams to tournament',
        'GET /api/tournaments/:tournamentId/teams': 'Get tournament teams',
        'DELETE /api/tournaments/:tournamentId/teams/:teamId': 'Remove team from tournament',
        'POST /api/tournaments/:tournamentId/fixtures/generate': 'Generate fixtures (with knockout stages)',
        'POST /api/tournaments/fixtures': 'Create a single fixture',
        'GET /api/tournaments/:tournamentId/fixtures': 'Get tournament fixtures',
        'POST /api/tournaments/fixtures/:fixtureId/link-match': 'Link match to fixture',
        'POST /api/tournaments/fixtures/:fixtureId/result': 'Record knockout result',
        'GET /api/tournaments/:tournamentId/points': 'Get points table',
        'POST /api/tournaments/:tournamentId/points/update': 'Update points after match',
        'GET /api/tournaments/:tournamentId/qualified': 'Get qualified teams for knockouts',
        'POST /api/tournaments/:tournamentId/knockouts/update': 'Update knockout fixtures',
        'POST /api/tournaments/stadiums': 'Create a stadium',
        'GET /api/tournaments/stadiums/all': 'Get all stadiums'
      },
      superOver: {
        'POST /api/tournaments/super-over/match/:matchId/start': 'Start super over',
        'POST /api/tournaments/super-over/:superOverId/ball': 'Record super over ball',
        'GET /api/tournaments/super-over/match/:matchId': 'Get super over result',
        'GET /api/tournaments/super-over/match/:matchId/winner': 'Determine super over winner',
        'POST /api/tournaments/super-over/match/:matchId/complete': 'Complete super over match'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Cricket Scoring API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API info: http://localhost:${PORT}/api`);
});

module.exports = app;
