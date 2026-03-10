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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'Cricket Scoring API',
    version: '1.0.0',
    endpoints: {
      teams: {
        'GET /api/teams': 'Get all teams',
        'GET /api/teams/:id': 'Get team by ID',
        'GET /api/teams/:id/players': 'Get players for a team'
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
