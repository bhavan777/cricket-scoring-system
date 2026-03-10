/**
 * Team Model - Handles data access for teams and players
 */

const { db } = require('../database');

const findAll = () => {
  return db.prepare('SELECT * FROM teams').all();
};

const findById = (id) => {
  return db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
};

const findPlayersByTeamId = (teamId) => {
  return db.prepare('SELECT * FROM players WHERE team_id = ?').all(teamId);
};

const findByPlayerId = (playerId) => {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
};

module.exports = {
  findAll,
  findById,
  findPlayersByTeamId,
  findByPlayerId
};
