/**
 * Tournament Model - Handles data access for tournaments, fixtures, points table, and stadiums
 */

const { db } = require('../database');

// ============ Tournaments ============

const findAllTournaments = () => {
  return db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all();
};

const findTournamentById = (id) => {
  return db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
};

const createTournament = (tournamentData) => {
  const { id, name, shortName, type, startDate, endDate, hostCountry } = tournamentData;
  const stmt = db.prepare(`
    INSERT INTO tournaments (id, name, short_name, type, start_date, end_date, host_country)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, shortName, type, startDate, endDate, hostCountry);
  return findTournamentById(id);
};

const updateTournament = (id, updates) => {
  const fields = [];
  const values = [];
  
  if (updates.name) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.shortName) { fields.push('short_name = ?'); values.push(updates.shortName); }
  if (updates.type) { fields.push('type = ?'); values.push(updates.type); }
  if (updates.startDate) { fields.push('start_date = ?'); values.push(updates.startDate); }
  if (updates.endDate) { fields.push('end_date = ?'); values.push(updates.endDate); }
  if (updates.hostCountry) { fields.push('host_country = ?'); values.push(updates.hostCountry); }
  if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
  
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE tournaments SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  
  return findTournamentById(id);
};

const deleteTournament = (id) => {
  return db.prepare('DELETE FROM tournaments WHERE id = ?').run(id);
};

// ============ Tournament Teams ============

const findTournamentTeams = (tournamentId) => {
  return db.prepare(`
    SELECT tt.*, t.name, t.short_name 
    FROM tournament_teams tt
    JOIN teams t ON tt.team_id = t.id
    WHERE tt.tournament_id = ?
    ORDER BY tt.group_name, t.name
  `).all(tournamentId);
};

const addTeamToTournament = (tournamentId, teamId, groupName = null) => {
  const id = `${tournamentId}-${teamId}`;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO tournament_teams (id, tournament_id, team_id, group_name)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, tournamentId, teamId, groupName);
  return findTournamentTeams(tournamentId);
};

const removeTeamFromTournament = (tournamentId, teamId) => {
  const id = `${tournamentId}-${teamId}`;
  return db.prepare('DELETE FROM tournament_teams WHERE id = ?').run(id);
};

// ============ Stadiums ============

const findAllStadiums = () => {
  return db.prepare('SELECT * FROM stadiums ORDER BY name').all();
};

const findStadiumById = (id) => {
  return db.prepare('SELECT * FROM stadiums WHERE id = ?').get(id);
};

const findStadiumsByCountry = (country) => {
  return db.prepare('SELECT * FROM stadiums WHERE country = ? ORDER BY name').all(country);
};

const createStadium = (stadiumData) => {
  const { id, name, city, country, capacity } = stadiumData;
  const stmt = db.prepare(`
    INSERT INTO stadiums (id, name, city, country, capacity)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, city, country, capacity);
  return findStadiumById(id);
};

// ============ Fixtures ============

const findFixturesByTournament = (tournamentId) => {
  return db.prepare(`
    SELECT f.*, 
           t1.name as team1_name, t1.short_name as team1_short_name,
           t2.name as team2_name, t2.short_name as team2_short_name,
           s.name as stadium_name, s.city as stadium_city,
           m.status as match_status, m.winner_id
    FROM fixtures f
    LEFT JOIN teams t1 ON f.team1_id = t1.id
    LEFT JOIN teams t2 ON f.team2_id = t2.id
    LEFT JOIN stadiums s ON f.stadium_id = s.id
    LEFT JOIN matches m ON f.match_id = m.id
    WHERE f.tournament_id = ?
    ORDER BY f.match_date, f.match_number
  `).all(tournamentId);
};

const findFixtureById = (fixtureId) => {
  return db.prepare(`
    SELECT f.*, 
           t1.name as team1_name, t1.short_name as team1_short_name,
           t2.name as team2_name, t2.short_name as team2_short_name,
           s.name as stadium_name, s.city as stadium_city
    FROM fixtures f
    LEFT JOIN teams t1 ON f.team1_id = t1.id
    LEFT JOIN teams t2 ON f.team2_id = t2.id
    LEFT JOIN stadiums s ON f.stadium_id = s.id
    WHERE f.id = ?
  `).get(fixtureId);
};

const createFixture = (fixtureData) => {
  const { id, tournamentId, matchNumber, team1Id, team2Id, matchDate, stadiumId, matchType, groupName, roundNumber } = fixtureData;
  const stmt = db.prepare(`
    INSERT INTO fixtures (id, tournament_id, match_number, team1_id, team2_id, match_date, stadium_id, match_type, group_name, round_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, tournamentId, matchNumber, team1Id, team2Id, matchDate, stadiumId, matchType || 'group', groupName, roundNumber || 1);
  return findFixtureById(id);
};

const updateFixture = (id, updates) => {
  const fields = [];
  const values = [];
  
  if (updates.matchDate) { fields.push('match_date = ?'); values.push(updates.matchDate); }
  if (updates.stadiumId) { fields.push('stadium_id = ?'); values.push(updates.stadiumId); }
  if (updates.matchId) { fields.push('match_id = ?'); values.push(updates.matchId); }
  if (updates.matchType) { fields.push('match_type = ?'); values.push(updates.matchType); }
  if (updates.groupName) { fields.push('group_name = ?'); values.push(updates.groupName); }
  if (updates.roundNumber) { fields.push('round_number = ?'); values.push(updates.roundNumber); }
  
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE fixtures SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  
  return findFixtureById(id);
};

const deleteFixture = (id) => {
  return db.prepare('DELETE FROM fixtures WHERE id = ?').run(id);
};

// Get team's match dates in a tournament (for 1-day gap validation)
const findTeamMatchDates = (tournamentId, teamId) => {
  return db.prepare(`
    SELECT match_date 
    FROM fixtures 
    WHERE tournament_id = ? AND (team1_id = ? OR team2_id = ?)
    ORDER BY match_date
  `).all(tournamentId, teamId, teamId).map(row => row.match_date);
};

// ============ Points Table ============

const findPointsTable = (tournamentId, groupName = null) => {
  let query = `
    SELECT pt.*, t.name as team_name, t.short_name as team_short_name
    FROM points_table pt
    JOIN teams t ON pt.team_id = t.id
    WHERE pt.tournament_id = ?
  `;
  
  if (groupName) {
    query += ' AND pt.group_name = ?';
    query += ' ORDER BY pt.points DESC, pt.net_run_rate DESC';
    return db.prepare(query).all(tournamentId, groupName);
  }
  
  query += ' ORDER BY pt.group_name, pt.points DESC, pt.net_run_rate DESC';
  return db.prepare(query).all(tournamentId);
};

const initializePointsTable = (tournamentId, teamId, groupName = null) => {
  const id = `${tournamentId}-${teamId}`;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO points_table (id, tournament_id, team_id, group_name)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, tournamentId, teamId, groupName);
};

const updatePointsTable = (tournamentId, teamId, updates) => {
  const id = `${tournamentId}-${teamId}`;
  const fields = [];
  const values = [];
  
  if (updates.matchesPlayed !== undefined) { fields.push('matches_played = ?'); values.push(updates.matchesPlayed); }
  if (updates.won !== undefined) { fields.push('won = ?'); values.push(updates.won); }
  if (updates.lost !== undefined) { fields.push('lost = ?'); values.push(updates.lost); }
  if (updates.tied !== undefined) { fields.push('tied = ?'); values.push(updates.tied); }
  if (updates.noResult !== undefined) { fields.push('no_result = ?'); values.push(updates.noResult); }
  if (updates.points !== undefined) { fields.push('points = ?'); values.push(updates.points); }
  if (updates.runsFor !== undefined) { fields.push('runs_for = ?'); values.push(updates.runsFor); }
  if (updates.runsAgainst !== undefined) { fields.push('runs_against = ?'); values.push(updates.runsAgainst); }
  if (updates.oversFor !== undefined) { fields.push('overs_for = ?'); values.push(updates.oversFor); }
  if (updates.oversAgainst !== undefined) { fields.push('overs_against = ?'); values.push(updates.oversAgainst); }
  if (updates.netRunRate !== undefined) { fields.push('net_run_rate = ?'); values.push(updates.netRunRate); }
  
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE points_table SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
};

// Get or create points entry
const getPointsEntry = (tournamentId, teamId) => {
  const id = `${tournamentId}-${teamId}`;
  return db.prepare('SELECT * FROM points_table WHERE id = ?').get(id);
};

module.exports = {
  // Tournaments
  findAllTournaments,
  findTournamentById,
  createTournament,
  updateTournament,
  deleteTournament,
  
  // Tournament Teams
  findTournamentTeams,
  addTeamToTournament,
  removeTeamFromTournament,
  
  // Stadiums
  findAllStadiums,
  findStadiumById,
  findStadiumsByCountry,
  createStadium,
  
  // Fixtures
  findFixturesByTournament,
  findFixtureById,
  createFixture,
  updateFixture,
  deleteFixture,
  findTeamMatchDates,
  
  // Points Table
  findPointsTable,
  initializePointsTable,
  updatePointsTable,
  getPointsEntry
};
