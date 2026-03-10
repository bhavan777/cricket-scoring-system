/**
 * Team Controller - Handles team and player requests
 */

const teamModel = require('../models/teamModel');

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

module.exports = {
  getAllTeams,
  getTeamById,
  getTeamPlayers,
  getPlayerById
};
