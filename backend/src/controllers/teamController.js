/**
 * Team Controller - Handles team and player requests
 */

const teamModel = require('../models/teamModel');

// ============ Teams ============

const getAllTeams = (req, res) => {
  try {
    const teams = teamModel.findAll();
    res.json({ success: true, data: teams });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getTeamById = (req, res) => {
  try {
    const team = teamModel.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }
    
    const players = teamModel.findPlayersByTeamId(req.params.id);
    team.players = players;
    
    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createTeam = (req, res) => {
  try {
    const { id, name, shortName, players } = req.body;
    
    if (!name || !shortName) {
      return res.status(400).json({ success: false, error: 'name and shortName are required' });
    }
    
    const team = teamModel.createTeam({ id, name, shortName });
    
    // If players are provided, add them
    if (players && Array.isArray(players) && players.length > 0) {
      teamModel.addPlayersToTeam(team.id, players);
    }
    
    // Return team with players
    const createdTeam = teamModel.findById(team.id);
    createdTeam.players = teamModel.findPlayersByTeamId(team.id);
    
    res.status(201).json({ success: true, data: createdTeam });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const updateTeam = (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const team = teamModel.findById(id);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }
    
    const updatedTeam = teamModel.updateTeam(id, updates);
    updatedTeam.players = teamModel.findPlayersByTeamId(id);
    
    res.json({ success: true, data: updatedTeam });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const deleteTeam = (req, res) => {
  try {
    const { id } = req.params;
    
    const team = teamModel.findById(id);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }
    
    const result = teamModel.deleteTeam(id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ============ Players ============

const getTeamPlayers = (req, res) => {
  try {
    const team = teamModel.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }
    
    const players = teamModel.findPlayersByTeamId(req.params.id);
    res.json({ success: true, data: { team, players } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getPlayerById = (req, res) => {
  try {
    const player = teamModel.findByPlayerId(req.params.playerId);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }
    res.json({ success: true, data: player });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createPlayer = (req, res) => {
  try {
    const { teamId } = req.params;
    const { id, name, role, battingStyle, bowlingStyle } = req.body;
    
    if (!name || !role) {
      return res.status(400).json({ success: false, error: 'name and role are required' });
    }
    
    const team = teamModel.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }
    
    const player = teamModel.createPlayer({
      id,
      teamId,
      name,
      role,
      battingStyle,
      bowlingStyle
    });
    
    res.status(201).json({ success: true, data: player });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const updatePlayer = (req, res) => {
  try {
    const { playerId } = req.params;
    const updates = req.body;
    
    const player = teamModel.findByPlayerId(playerId);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }
    
    const updatedPlayer = teamModel.updatePlayer(playerId, updates);
    res.json({ success: true, data: updatedPlayer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const deletePlayer = (req, res) => {
  try {
    const { playerId } = req.params;
    
    const player = teamModel.findByPlayerId(playerId);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }
    
    const result = teamModel.deletePlayer(playerId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const addPlayersToTeam = (req, res) => {
  try {
    const { teamId } = req.params;
    const { players } = req.body;
    
    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ success: false, error: 'players array is required' });
    }
    
    const team = teamModel.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }
    
    const insertedPlayers = teamModel.addPlayersToTeam(teamId, players);
    res.status(201).json({ success: true, data: insertedPlayers });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

module.exports = {
  // Teams
  getAllTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  
  // Players
  getTeamPlayers,
  getPlayerById,
  createPlayer,
  updatePlayer,
  deletePlayer,
  addPlayersToTeam
};
