/**
 * Tournament Service - Handles tournament creation, fixture generation, and points management
 */

const { v4: uuidv4 } = require('uuid');
const tournamentModel = require('../models/tournamentModel');
const teamModel = require('../models/teamModel');
const { db } = require('../database');

/**
 * Create a new tournament
 */
const createTournament = (tournamentData) => {
  const { name, shortName, type, startDate, endDate, hostCountry } = tournamentData;
  
  if (!name || !shortName || !type || !startDate || !endDate) {
    throw new Error('Missing required fields: name, shortName, type, startDate, endDate');
  }
  
  const id = `tournament-${uuidv4()}`;
  
  return tournamentModel.createTournament({
    id,
    name,
    shortName,
    type,
    startDate,
    endDate,
    hostCountry
  });
};

/**
 * Get all tournaments
 */
const getAllTournaments = () => {
  return tournamentModel.findAllTournaments();
};

/**
 * Get tournament by ID with full details
 */
const getTournamentById = (tournamentId) => {
  const tournament = tournamentModel.findTournamentById(tournamentId);
  if (!tournament) return null;
  
  const teams = tournamentModel.findTournamentTeams(tournamentId);
  const fixtures = tournamentModel.findFixturesByTournament(tournamentId);
  const pointsTable = tournamentModel.findPointsTable(tournamentId);
  
  return {
    ...tournament,
    teams,
    fixtures,
    pointsTable
  };
};

/**
 * Add teams to a tournament
 */
const addTeamsToTournament = (tournamentId, teamIds, groupConfig = null) => {
  const tournament = tournamentModel.findTournamentById(tournamentId);
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  const addedTeams = [];
  
  for (const teamId of teamIds) {
    const team = teamModel.findById(teamId);
    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }
    
    // Determine group name
    let groupName = null;
    if (groupConfig && groupConfig[teamId]) {
      groupName = groupConfig[teamId];
    }
    
    tournamentModel.addTeamToTournament(tournamentId, teamId, groupName);
    
    // Initialize points table entry
    tournamentModel.initializePointsTable(tournamentId, teamId, groupName);
    
    addedTeams.push({ teamId, groupName });
  }
  
  return tournamentModel.findTournamentTeams(tournamentId);
};

/**
 * Generate fixtures for a tournament with 1-day gap constraint
 */
const generateFixtures = (tournamentId, options = {}) => {
  const tournament = tournamentModel.findTournamentById(tournamentId);
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  const teams = tournamentModel.findTournamentTeams(tournamentId);
  if (teams.length < 2) {
    throw new Error('Need at least 2 teams to generate fixtures');
  }
  
  const { 
    matchType = 'group',
    stadiumIds = [],
    groupNames = [],
    roundRobin = true
  } = options;
  
  const startDate = new Date(tournament.start_date);
  const teamIds = teams.map(t => t.team_id);
  
  // Group teams by group_name if applicable
  const groups = {};
  teams.forEach(t => {
    const groupName = t.group_name || 'default';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(t.team_id);
  });
  
  const fixtures = [];
  let matchNumber = 1;
  let currentDate = new Date(startDate);
  
  // Track last match date for each team
  const teamLastMatchDate = {};
  
  // Generate fixtures for each group
  const groupKeys = Object.keys(groups);
  
  for (const groupName of groupKeys) {
    const groupTeams = groups[groupName];
    
    if (roundRobin) {
      // Round-robin fixtures within group
      const pairings = generateRoundRobinPairings(groupTeams);
      
      for (const pairing of pairings) {
        const { team1Id, team2Id } = pairing;
        
        // Find a date that satisfies 1-day gap for both teams
        const validDate = findValidMatchDate(
          currentDate,
          team1Id,
          team2Id,
          teamLastMatchDate
        );
        
        // Assign stadium (rotate through available stadiums)
        const stadiumId = stadiumIds.length > 0 
          ? stadiumIds[(matchNumber - 1) % stadiumIds.length] 
          : null;
        
        const fixtureId = `fixture-${uuidv4()}`;
        const fixture = tournamentModel.createFixture({
          id: fixtureId,
          tournamentId,
          matchNumber,
          team1Id,
          team2Id,
          matchDate: validDate.toISOString().split('T')[0],
          stadiumId,
          matchType,
          groupName: groupName !== 'default' ? groupName : null,
          roundNumber: 1
        });
        
        // Update last match dates
        teamLastMatchDate[team1Id] = validDate;
        teamLastMatchDate[team2Id] = validDate;
        
        fixtures.push(fixture);
        matchNumber++;
        
        // Move current date forward if needed
        if (validDate >= currentDate) {
          currentDate = new Date(validDate);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }
  }
  
  return fixtures;
};

/**
 * Generate round-robin pairings
 */
const generateRoundRobinPairings = (teamIds) => {
  const pairings = [];
  const n = teamIds.length;
  
  // Each team plays every other team once
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairings.push({
        team1Id: teamIds[i],
        team2Id: teamIds[j]
      });
    }
  }
  
  // Shuffle pairings for variety
  return shuffleArray(pairings);
};

/**
 * Find a valid match date ensuring 1-day gap for both teams
 */
const findValidMatchDate = (startDate, team1Id, team2Id, teamLastMatchDate) => {
  let candidateDate = new Date(startDate);
  
  // Check existing fixtures in the tournament for these teams
  const team1Dates = tournamentModel.findTeamMatchDates(
    teamLastMatchDate.tournamentId || '', 
    team1Id
  );
  const team2Dates = tournamentModel.findTeamMatchDates(
    teamLastMatchDate.tournamentId || '', 
    team2Id
  );
  
  // Also consider dates tracked in current generation
  const team1LastDate = teamLastMatchDate[team1Id];
  const team2LastDate = teamLastMatchDate[team2Id];
  
  let maxAttempts = 365; // Prevent infinite loop
  while (maxAttempts > 0) {
    const dateStr = candidateDate.toISOString().split('T')[0];
    
    // Check if both teams have at least 1 day gap
    const team1CanPlay = !team1LastDate || hasMinimumGap(team1LastDate, candidateDate, 1);
    const team2CanPlay = !team2LastDate || hasMinimumGap(team2LastDate, candidateDate, 1);
    
    if (team1CanPlay && team2CanPlay) {
      return candidateDate;
    }
    
    // Move to next day
    candidateDate.setDate(candidateDate.getDate() + 1);
    maxAttempts--;
  }
  
  throw new Error('Could not find valid match date within 1 year');
};

/**
 * Check if there's minimum gap days between two dates
 */
const hasMinimumGap = (date1, date2, minGapDays) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= minGapDays;
};

/**
 * Shuffle array using Fisher-Yates algorithm
 */
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Create a single fixture manually
 */
const createFixture = (fixtureData) => {
  const { tournamentId, team1Id, team2Id, matchDate, stadiumId, matchType, groupName, roundNumber } = fixtureData;
  
  // Validate tournament exists
  const tournament = tournamentModel.findTournamentById(tournamentId);
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  // Validate teams exist
  const team1 = teamModel.findById(team1Id);
  const team2 = teamModel.findById(team2Id);
  if (!team1 || !team2) {
    throw new Error('One or both teams not found');
  }
  
  // Validate 1-day gap constraint
  const team1Dates = tournamentModel.findTeamMatchDates(tournamentId, team1Id);
  const team2Dates = tournamentModel.findTeamMatchDates(tournamentId, team2Id);
  const newDate = new Date(matchDate);
  
  for (const existingDate of team1Dates) {
    if (!hasMinimumGap(existingDate, newDate, 1)) {
      throw new Error(`Team ${team1.name} already has a match within 1 day of ${matchDate}`);
    }
  }
  
  for (const existingDate of team2Dates) {
    if (!hasMinimumGap(existingDate, newDate, 1)) {
      throw new Error(`Team ${team2.name} already has a match within 1 day of ${matchDate}`);
    }
  }
  
  // Get next match number
  const existingFixtures = tournamentModel.findFixturesByTournament(tournamentId);
  const matchNumber = existingFixtures.length + 1;
  
  const fixtureId = `fixture-${uuidv4()}`;
  
  return tournamentModel.createFixture({
    id: fixtureId,
    tournamentId,
    matchNumber,
    team1Id,
    team2Id,
    matchDate,
    stadiumId,
    matchType: matchType || 'group',
    groupName,
    roundNumber: roundNumber || 1
  });
};

/**
 * Update points table after a match
 */
const updatePointsAfterMatch = (tournamentId, matchId, result) => {
  const { winnerId, loserId, isTie, isNoResult, team1Runs, team2Runs, team1Overs, team2Overs } = result;
  
  // Get teams from match
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) throw new Error('Match not found');
  
  const team1Id = match.team1_id;
  const team2Id = match.team2_id;
  
  if (isTie) {
    // Both teams get 1 point
    updateTeamPoints(tournamentId, team1Id, { 
      matchesPlayed: 1, tied: 1, points: 1,
      runsFor: team1Runs, runsAgainst: team2Runs,
      oversFor: team1Overs, oversAgainst: team2Overs
    });
    updateTeamPoints(tournamentId, team2Id, { 
      matchesPlayed: 1, tied: 1, points: 1,
      runsFor: team2Runs, runsAgainst: team1Runs,
      oversFor: team2Overs, oversAgainst: team1Overs
    });
  } else if (isNoResult) {
    // Both teams get 1 point
    updateTeamPoints(tournamentId, team1Id, { 
      matchesPlayed: 1, noResult: 1, points: 1 
    });
    updateTeamPoints(tournamentId, team2Id, { 
      matchesPlayed: 1, noResult: 1, points: 1 
    });
  } else if (winnerId) {
    const loserId = winnerId === team1Id ? team2Id : team1Id;
    const winnerRuns = winnerId === team1Id ? team1Runs : team2Runs;
    const winnerOvers = winnerId === team1Id ? team1Overs : team2Overs;
    const loserRuns = winnerId === team1Id ? team2Runs : team1Runs;
    const loserOvers = winnerId === team1Id ? team2Overs : team1Overs;
    
    // Winner gets 2 points
    updateTeamPoints(tournamentId, winnerId, { 
      matchesPlayed: 1, won: 1, points: 2,
      runsFor: winnerRuns, runsAgainst: loserRuns,
      oversFor: winnerOvers, oversAgainst: loserOvers
    });
    updateTeamPoints(tournamentId, loserId, { 
      matchesPlayed: 1, lost: 1, points: 0,
      runsFor: loserRuns, runsAgainst: winnerRuns,
      oversFor: loserOvers, oversAgainst: winnerOvers
    });
  }
  
  // Recalculate NRR for all teams
  recalculateNRR(tournamentId);
  
  return tournamentModel.findPointsTable(tournamentId);
};

/**
 * Update team points helper
 */
const updateTeamPoints = (tournamentId, teamId, updates) => {
  const current = tournamentModel.getPointsEntry(tournamentId, teamId);
  
  if (!current) {
    tournamentModel.initializePointsTable(tournamentId, teamId);
  }
  
  const newValues = {
    matchesPlayed: (current?.matches_played || 0) + (updates.matchesPlayed || 0),
    won: (current?.won || 0) + (updates.won || 0),
    lost: (current?.lost || 0) + (updates.lost || 0),
    tied: (current?.tied || 0) + (updates.tied || 0),
    noResult: (current?.no_result || 0) + (updates.noResult || 0),
    points: (current?.points || 0) + (updates.points || 0),
    runsFor: (current?.runs_for || 0) + (updates.runsFor || 0),
    runsAgainst: (current?.runs_against || 0) + (updates.runsAgainst || 0),
    oversFor: (current?.overs_for || 0) + (updates.oversFor || 0),
    oversAgainst: (current?.overs_against || 0) + (updates.oversAgainst || 0)
  };
  
  tournamentModel.updatePointsTable(tournamentId, teamId, newValues);
};

/**
 * Recalculate Net Run Rate for all teams
 */
const recalculateNRR = (tournamentId) => {
  const pointsTable = tournamentModel.findPointsTable(tournamentId);
  
  for (const entry of pointsTable) {
    const runsFor = entry.runs_for || 0;
    const runsAgainst = entry.runs_against || 0;
    const oversFor = parseFloat(entry.overs_for) || 0;
    const oversAgainst = parseFloat(entry.overs_against) || 0;
    
    // NRR = (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
    const runRateFor = oversFor > 0 ? runsFor / oversFor : 0;
    const runRateAgainst = oversAgainst > 0 ? runsAgainst / oversAgainst : 0;
    const nrr = runRateFor - runRateAgainst;
    
    tournamentModel.updatePointsTable(tournamentId, entry.team_id, { 
      netRunRate: parseFloat(nrr.toFixed(3)) 
    });
  }
};

/**
 * Create a stadium
 */
const createStadium = (stadiumData) => {
  const { name, city, country, capacity } = stadiumData;
  
  if (!name || !city || !country) {
    throw new Error('Missing required fields: name, city, country');
  }
  
  const id = `stadium-${uuidv4()}`;
  
  return tournamentModel.createStadium({
    id,
    name,
    city,
    country,
    capacity: capacity || 0
  });
};

/**
 * Get all stadiums
 */
const getAllStadiums = () => {
  return tournamentModel.findAllStadiums();
};

/**
 * Get fixtures for a tournament
 */
const getTournamentFixtures = (tournamentId) => {
  return tournamentModel.findFixturesByTournament(tournamentId);
};

/**
 * Get points table for a tournament
 */
const getPointsTable = (tournamentId, groupName = null) => {
  return tournamentModel.findPointsTable(tournamentId, groupName);
};

/**
 * Delete a tournament and all associated data
 */
const deleteTournament = (tournamentId) => {
  // Delete in order due to foreign key constraints
  db.prepare('DELETE FROM points_table WHERE tournament_id = ?').run(tournamentId);
  db.prepare('DELETE FROM fixtures WHERE tournament_id = ?').run(tournamentId);
  db.prepare('DELETE FROM tournament_teams WHERE tournament_id = ?').run(tournamentId);
  
  return tournamentModel.deleteTournament(tournamentId);
};

/**
 * Link a match to a fixture
 */
const linkMatchToFixture = (fixtureId, matchId) => {
  return tournamentModel.updateFixture(fixtureId, { matchId });
};

/**
 * Get tournament teams
 */
const getTournamentTeams = (tournamentId) => {
  return tournamentModel.findTournamentTeams(tournamentId);
};

/**
 * Remove team from tournament
 */
const removeTeamFromTournament = (tournamentId, teamId) => {
  // Check if team has any fixtures
  const fixtures = tournamentModel.findFixturesByTournament(tournamentId);
  const teamFixtures = fixtures.filter(f => 
    f.team1_id === teamId || f.team2_id === teamId
  );
  
  if (teamFixtures.length > 0) {
    throw new Error('Cannot remove team with existing fixtures. Delete fixtures first.');
  }
  
  // Remove from points table
  db.prepare('DELETE FROM points_table WHERE tournament_id = ? AND team_id = ?').run(tournamentId, teamId);
  
  return tournamentModel.removeTeamFromTournament(tournamentId, teamId);
};

module.exports = {
  createTournament,
  getAllTournaments,
  getTournamentById,
  addTeamsToTournament,
  generateFixtures,
  createFixture,
  updatePointsAfterMatch,
  createStadium,
  getAllStadiums,
  getTournamentFixtures,
  getPointsTable,
  deleteTournament,
  linkMatchToFixture,
  getTournamentTeams,
  removeTeamFromTournament
};
