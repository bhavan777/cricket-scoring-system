/**
 * Tournament Controller - Handles tournament API requests
 */

const tournamentService = require('../services/tournamentService');

// ============ Tournament CRUD ============

const createTournament = (req, res) => {
  try {
    const tournament = tournamentService.createTournament(req.body);
    res.status(201).json({ success: true, data: tournament });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getAllTournaments = (req, res) => {
  try {
    const tournaments = tournamentService.getAllTournaments();
    res.json({ success: true, data: tournaments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getTournamentById = (req, res) => {
  try {
    const tournament = tournamentService.getTournamentById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }
    res.json({ success: true, data: tournament });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteTournament = (req, res) => {
  try {
    const result = tournamentService.deleteTournament(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============ Tournament Teams ============

const addTeamsToTournament = (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { teamIds, groupConfig } = req.body;
    
    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
      return res.status(400).json({ success: false, error: 'teamIds array is required' });
    }
    
    const teams = tournamentService.addTeamsToTournament(tournamentId, teamIds, groupConfig);
    res.json({ success: true, data: teams });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getTournamentTeams = (req, res) => {
  try {
    const teams = tournamentService.getTournamentTeams(req.params.tournamentId);
    res.json({ success: true, data: teams });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const removeTeamFromTournament = (req, res) => {
  try {
    const { tournamentId, teamId } = req.params;
    const result = tournamentService.removeTeamFromTournament(tournamentId, teamId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ============ Fixtures ============

const generateFixtures = (req, res) => {
  try {
    const { tournamentId } = req.params;
    const options = req.body || {};
    
    const fixtures = tournamentService.generateFixtures(tournamentId, options);
    res.status(201).json({ success: true, data: fixtures });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const createFixture = (req, res) => {
  try {
    const fixture = tournamentService.createFixture(req.body);
    res.status(201).json({ success: true, data: fixture });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getTournamentFixtures = (req, res) => {
  try {
    const fixtures = tournamentService.getTournamentFixtures(req.params.tournamentId);
    res.json({ success: true, data: fixtures });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const linkMatchToFixture = (req, res) => {
  try {
    const { fixtureId } = req.params;
    const { matchId } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ success: false, error: 'matchId is required' });
    }
    
    const fixture = tournamentService.linkMatchToFixture(fixtureId, matchId);
    res.json({ success: true, data: fixture });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============ Points Table ============

const getPointsTable = (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { group } = req.query;
    
    const pointsTable = tournamentService.getPointsTable(tournamentId, group);
    res.json({ success: true, data: pointsTable });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updatePointsAfterMatch = (req, res) => {
  try {
    const { tournamentId } = req.params;
    const result = req.body;
    
    const pointsTable = tournamentService.updatePointsAfterMatch(tournamentId, result.matchId, result);
    res.json({ success: true, data: pointsTable });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ============ Stadiums ============

const createStadium = (req, res) => {
  try {
    const stadium = tournamentService.createStadium(req.body);
    res.status(201).json({ success: true, data: stadium });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getAllStadiums = (req, res) => {
  try {
    const stadiums = tournamentService.getAllStadiums();
    res.json({ success: true, data: stadiums });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  // Tournament CRUD
  createTournament,
  getAllTournaments,
  getTournamentById,
  deleteTournament,
  
  // Tournament Teams
  addTeamsToTournament,
  getTournamentTeams,
  removeTeamFromTournament,
  
  // Fixtures
  generateFixtures,
  createFixture,
  getTournamentFixtures,
  linkMatchToFixture,
  
  // Points Table
  getPointsTable,
  updatePointsAfterMatch,
  
  // Stadiums
  createStadium,
  getAllStadiums
};
