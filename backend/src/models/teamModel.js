/**
 * Team Model - Handles data access for teams and players
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

// ============ Teams ============

const findAll = () => {
  return db.prepare('SELECT * FROM teams ORDER BY name').all();
};

const findById = (id) => {
  return db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
};

const createTeam = (teamData) => {
  const { id, name, shortName } = teamData;
  const teamId = id || `team-${uuidv4()}`;
  
  const stmt = db.prepare(`
    INSERT INTO teams (id, name, short_name)
    VALUES (?, ?, ?)
  `);
  stmt.run(teamId, name, shortName);
  
  return findById(teamId);
};

const updateTeam = (id, updates) => {
  const fields = [];
  const values = [];
  
  if (updates.name) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.shortName) { fields.push('short_name = ?'); values.push(updates.shortName); }
  
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE teams SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  
  return findById(id);
};

const deleteTeam = (id) => {
  // First delete all players belonging to this team
  db.prepare('DELETE FROM players WHERE team_id = ?').run(id);
  // Then delete the team
  const result = db.prepare('DELETE FROM teams WHERE id = ?').run(id);
  return { deleted: result.changes > 0, id };
};

// ============ Players ============

const findPlayersByTeamId = (teamId) => {
  return db.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY id').all(teamId);
};

const findByPlayerId = (playerId) => {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
};

const createPlayer = (playerData) => {
  const { id, teamId, name, role, battingStyle, bowlingStyle } = playerData;
  const playerId = id || `${teamId.split('-')[0]}-${uuidv4().split('-')[0]}`;
  
  const stmt = db.prepare(`
    INSERT INTO players (id, team_id, name, role, batting_style, bowling_style)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(playerId, teamId, name, role, battingStyle || null, bowlingStyle || null);
  
  return findByPlayerId(playerId);
};

const updatePlayer = (id, updates) => {
  const fields = [];
  const values = [];
  
  if (updates.name) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.role) { fields.push('role = ?'); values.push(updates.role); }
  if (updates.battingStyle) { fields.push('batting_style = ?'); values.push(updates.battingStyle); }
  if (updates.bowlingStyle) { fields.push('bowling_style = ?'); values.push(updates.bowlingStyle); }
  
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  
  return findByPlayerId(id);
};

const deletePlayer = (id) => {
  const result = db.prepare('DELETE FROM players WHERE id = ?').run(id);
  return { deleted: result.changes > 0, id };
};

const addPlayersToTeam = (teamId, players) => {
  const insertPlayer = db.prepare(`
    INSERT INTO players (id, team_id, name, role, batting_style, bowling_style)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const teamPrefix = teamId.split('-')[0];
  const insertedPlayers = [];
  
  for (const player of players) {
    const playerId = player.id || `${teamPrefix}-${uuidv4().split('-')[0]}`;
    insertPlayer.run(
      playerId,
      teamId,
      player.name,
      player.role,
      player.battingStyle || null,
      player.bowlingStyle || null
    );
    insertedPlayers.push(findByPlayerId(playerId));
  }
  
  return insertedPlayers;
};

module.exports = {
  // Teams
  findAll,
  findById,
  createTeam,
  updateTeam,
  deleteTeam,
  
  // Players
  findPlayersByTeamId,
  findByPlayerId,
  createPlayer,
  updatePlayer,
  deletePlayer,
  addPlayersToTeam
};
