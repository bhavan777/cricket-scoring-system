/**
 * Tournament Service - Handles tournament creation, fixture generation, and points management
 */

const { v4: uuidv4 } = require('uuid');
const tournamentModel = require('../models/tournamentModel');
const teamModel = require('../models/teamModel');
const { db } = require('../database');

// Tournament stage constants
const STAGES = {
  GROUP: 'group',
  QUARTER_FINAL: 'quarter_final',
  SEMI_FINAL: 'semi_final',
  FINAL: 'final'
};

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
 * Update tournament details
 */
const updateTournament = (tournamentId, updates) => {
  const tournament = tournamentModel.findTournamentById(tournamentId);
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  return tournamentModel.updateTournament(tournamentId, updates);
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
  
  let { 
    matchType = 'group',
    stadiumIds = [],
    roundRobin = true,
    includeKnockouts = true,
    knockoutTeams = 4  // Number of teams qualifying for knockouts
  } = options;
  
  // Ensure stadiumIds is an array
  if (typeof stadiumIds === 'string') {
    stadiumIds = stadiumIds.split(',').filter(id => id.trim().length > 0);
  }
  
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
  
  // Track last match date for each team (ensures no back-to-back matches)
  const teamLastMatchDate = {};
  
  // Track stadium usage for better distribution
  const stadiumUsage = {};
  stadiumIds.forEach(s => stadiumUsage[s] = 0);
  
  // Track matches per day for each stadium (max 1 match per stadium per day)
  const stadiumDayUsage = {};
  
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
          teamLastMatchDate,
          tournamentId
        );
        
        // Assign stadium (distribute across available stadiums, avoiding same stadium on same day)
        const stadiumId = assignStadium(stadiumIds, validDate, stadiumUsage, stadiumDayUsage);
        
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
          roundNumber: 1,
          stage: STAGES.GROUP
        });
        
        // Update last match dates (ensures no back-to-back for same team)
        teamLastMatchDate[team1Id] = validDate;
        teamLastMatchDate[team2Id] = validDate;
        
        // Update stadium usage
        if (stadiumId) {
          stadiumUsage[stadiumId]++;
          const dateStr = validDate.toISOString().split('T')[0];
          if (!stadiumDayUsage[stadiumId]) stadiumDayUsage[stadiumId] = new Set();
          stadiumDayUsage[stadiumId].add(dateStr);
        }
        
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
  
  // Generate knockout stage placeholder fixtures
  if (includeKnockouts && teams.length >= 4) {
    const knockoutFixtures = generateKnockoutFixtures(
      tournamentId, 
      currentDate, 
      matchNumber, 
      stadiumIds,
      knockoutTeams
    );
    fixtures.push(...knockoutFixtures);
  }
  
  return fixtures;
};

/**
 * Assign stadium with proper distribution
 * - Avoids same stadium on same day
 * - Balances usage across stadiums
 */
const assignStadium = (stadiumIds, matchDate, stadiumUsage, stadiumDayUsage) => {
  if (stadiumIds.length === 0) return null;
  
  const dateStr = matchDate.toISOString().split('T')[0];
  
  // Filter out stadiums already used on this day
  const availableStadiums = stadiumIds.filter(s => {
    if (!stadiumDayUsage[s]) return true;
    return !stadiumDayUsage[s].has(dateStr);
  });
  
  // If all stadiums are used on this day, allow reuse but pick least used
  const candidates = availableStadiums.length > 0 ? availableStadiums : stadiumIds;
  
  // Sort by usage count (ascending) to pick least used stadium
  candidates.sort((a, b) => (stadiumUsage[a] || 0) - (stadiumUsage[b] || 0));
  
  return candidates[0];
};

/**
 * Generate knockout stage fixtures (quarter-finals, semi-finals, final)
 */
const generateKnockoutFixtures = (tournamentId, startDate, startMatchNumber, stadiumIds, qualifyingTeams = 4) => {
  const fixtures = [];
  let matchNumber = startMatchNumber;
  let currentDate = new Date(startDate);
  
  // Determine knockout structure based on qualifying teams
  const hasQuarterFinals = qualifyingTeams === 8;
  const numQuarterFinals = hasQuarterFinals ? 4 : 0;
  const numSemiFinals = 2;
  
  // Add rest day between group stage and knockouts
  currentDate.setDate(currentDate.getDate() + 2);
  
  // Quarter Finals (if 8 teams qualify)
  if (hasQuarterFinals) {
    for (let i = 0; i < numQuarterFinals; i++) {
      const fixtureId = `fixture-${uuidv4()}`;
      const stadiumId = stadiumIds.length > 0 ? stadiumIds[i % stadiumIds.length] : null;
      
      const fixture = tournamentModel.createFixture({
        id: fixtureId,
        tournamentId,
        matchNumber,
        team1Id: null,  // To be determined after group stage
        team2Id: null,
        matchDate: currentDate.toISOString().split('T')[0],
        stadiumId,
        matchType: 'knockout',
        groupName: null,
        roundNumber: 1,
        stage: STAGES.QUARTER_FINAL,
        stagePosition: i + 1,
        team1QualificationRule: `QF${i + 1}_Team1`,  // e.g., "Winner Group A" or "2nd Group B"
        team2QualificationRule: `QF${i + 1}_Team2`
      });
      
      fixtures.push(fixture);
      matchNumber++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Rest day before semi-finals
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Semi Finals
  for (let i = 0; i < numSemiFinals; i++) {
    const fixtureId = `fixture-${uuidv4()}`;
    const stadiumId = stadiumIds.length > 0 ? stadiumIds[i % stadiumIds.length] : null;
    
    const fixture = tournamentModel.createFixture({
      id: fixtureId,
      tournamentId,
      matchNumber,
      team1Id: null,
      team2Id: null,
      matchDate: currentDate.toISOString().split('T')[0],
      stadiumId,
      matchType: 'knockout',
      groupName: null,
      roundNumber: 1,
      stage: STAGES.SEMI_FINAL,
      stagePosition: i + 1,
      team1QualificationRule: `SF${i + 1}_Team1`,
      team2QualificationRule: `SF${i + 1}_Team2`
    });
    
    fixtures.push(fixture);
    matchNumber++;
    currentDate.setDate(currentDate.getDate() + 2);  // Rest day between semis
  }
  
  // Rest day before final
  currentDate.setDate(currentDate.getDate() + 1);
  
  // Final
  const finalFixtureId = `fixture-${uuidv4()}`;
  const finalStadiumId = stadiumIds.length > 0 ? stadiumIds[0] : null;  // Main stadium for final
  
  const finalFixture = tournamentModel.createFixture({
    id: finalFixtureId,
    tournamentId,
    matchNumber,
    team1Id: null,
    team2Id: null,
    matchDate: currentDate.toISOString().split('T')[0],
    stadiumId: finalStadiumId,
    matchType: 'knockout',
    groupName: null,
    roundNumber: 1,
    stage: STAGES.FINAL,
    stagePosition: 1,
    team1QualificationRule: 'FINAL_Team1',
    team2QualificationRule: 'FINAL_Team2'
  });
  
  fixtures.push(finalFixture);
  
  return fixtures;
};

/**
 * Update knockout fixtures with qualified teams
 */
const updateKnockoutFixtures = (tournamentId, qualificationRules) => {
  // qualificationRules is a map like:
  // { "QF1_Team1": "team-india", "QF1_Team2": "team-eng", ... }
  
  const pendingFixtures = tournamentModel.findPendingKnockoutFixtures(tournamentId);
  
  for (const fixture of pendingFixtures) {
    const team1Id = qualificationRules[fixture.team1_qualification_rule];
    const team2Id = qualificationRules[fixture.team2_qualification_rule];
    
    if (team1Id && team2Id) {
      tournamentModel.updateFixture(fixture.id, { team1Id, team2Id });
    }
  }
  
  return tournamentModel.findFixturesByTournament(tournamentId);
};

/**
 * Get qualified teams for knockout stages based on points table
 */
const getQualifiedTeams = (tournamentId, numTeams = 4) => {
  const pointsTable = tournamentModel.findPointsTable(tournamentId);
  
  // Sort by points (desc), then by NRR (desc)
  const sorted = pointsTable.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.net_run_rate - a.net_run_rate;
  });
  
  return sorted.slice(0, numTeams).map(entry => ({
    teamId: entry.team_id,
    teamName: entry.team_name,
    position: sorted.indexOf(entry) + 1,
    points: entry.points,
    nrr: entry.net_run_rate,
    groupName: entry.group_name
  }));
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
const findValidMatchDate = (startDate, team1Id, team2Id, teamLastMatchDate, tournamentId) => {
  let candidateDate = new Date(startDate);
  
  // Check existing fixtures in the tournament for these teams
  const team1Dates = tournamentModel.findTeamMatchDates(tournamentId, team1Id);
  const team2Dates = tournamentModel.findTeamMatchDates(tournamentId, team2Id);
  
  // Also consider dates tracked in current generation
  const team1LastDate = teamLastMatchDate[team1Id];
  const team2LastDate = teamLastMatchDate[team2Id];
  
  let maxAttempts = 365; // Prevent infinite loop
  while (maxAttempts > 0) {
    const dateStr = candidateDate.toISOString().split('T')[0];
    
    // Check existing dates from database
    let team1CanPlay = true;
    let team2CanPlay = true;
    
    for (const existingDate of team1Dates) {
      if (!hasMinimumGap(existingDate, candidateDate, 1)) {
        team1CanPlay = false;
        break;
      }
    }
    
    for (const existingDate of team2Dates) {
      if (!hasMinimumGap(existingDate, candidateDate, 1)) {
        team2CanPlay = false;
        break;
      }
    }
    
    // Check dates from current generation
    if (team1CanPlay && team1LastDate && !hasMinimumGap(team1LastDate, candidateDate, 1)) {
      team1CanPlay = false;
    }
    if (team2CanPlay && team2LastDate && !hasMinimumGap(team2LastDate, candidateDate, 1)) {
      team2CanPlay = false;
    }
    
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
 * Returns true if dates are at least minGapDays apart
 */
const hasMinimumGap = (date1, date2, minGapDays) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > minGapDays;  // Must be MORE than minGapDays (not equal)
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
  const { tournamentId, team1Id, team2Id, matchDate, stadiumId, matchType, groupName, roundNumber, stage, stagePosition } = fixtureData;
  
  // Validate tournament exists
  const tournament = tournamentModel.findTournamentById(tournamentId);
  if (!tournament) {
    throw new Error('Tournament not found');
  }
  
  // Validate teams exist (if provided)
  if (team1Id) {
    const team1 = teamModel.findById(team1Id);
    if (!team1) throw new Error('Team 1 not found');
  }
  
  if (team2Id) {
    const team2 = teamModel.findById(team2Id);
    if (!team2) throw new Error('Team 2 not found');
  }
  
  // Validate 1-day gap constraint (only if both teams are provided)
  if (team1Id && team2Id) {
    const team1Dates = tournamentModel.findTeamMatchDates(tournamentId, team1Id);
    const team2Dates = tournamentModel.findTeamMatchDates(tournamentId, team2Id);
    const newDate = new Date(matchDate);
    
    for (const existingDate of team1Dates) {
      if (!hasMinimumGap(existingDate, newDate, 1)) {
        throw new Error(`Team already has a match within 1 day of ${matchDate}`);
      }
    }
    
    for (const existingDate of team2Dates) {
      if (!hasMinimumGap(existingDate, newDate, 1)) {
        throw new Error(`Team already has a match within 1 day of ${matchDate}`);
      }
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
    roundNumber: roundNumber || 1,
    stage: stage || STAGES.GROUP,
    stagePosition
  });
};

/**
 * Update points table after a match with proper NRR calculation
 */
const updatePointsAfterMatch = (tournamentId, matchId, result) => {
  const { 
    winnerId, 
    loserId, 
    isTie, 
    isNoResult, 
    team1Runs, 
    team2Runs, 
    team1Overs, 
    team2Overs,
    team1Wickets,
    team2Wickets,
    isSuperOver,
    superOverWinnerId
  } = result;
  
  // Get teams from match
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) throw new Error('Match not found');
  
  const team1Id = match.team1_id;
  const team2Id = match.team2_id;
  
  // For knockout matches, don't update points table
  const fixture = db.prepare('SELECT * FROM fixtures WHERE match_id = ?').get(matchId);
  if (fixture && fixture.stage !== STAGES.GROUP) {
    // Just update the fixture with winner
    if (winnerId || superOverWinnerId) {
      tournamentModel.updateFixture(fixture.id, { 
        winnerId: winnerId || superOverWinnerId,
        isSuperOver: isSuperOver ? 1 : 0
      });
    }
    return tournamentModel.findFixturesByTournament(tournamentId);
  }
  
  // Calculate overs properly for NRR
  // In T20, if team is all out, they face full 20 overs for NRR calculation
  const oversTeam1 = team1Wickets >= 10 ? 20 : (team1Overs || 20);
  const oversTeam2 = team2Wickets >= 10 ? 20 : (team2Overs || 20);
  
  if (isTie && !isSuperOver) {
    // Tie without super over - both teams get 1 point
    updateTeamPoints(tournamentId, team1Id, { 
      matchesPlayed: 1, tied: 1, points: 1,
      runsFor: team1Runs, runsAgainst: team2Runs,
      oversFor: oversTeam1, oversAgainst: oversTeam2
    });
    updateTeamPoints(tournamentId, team2Id, { 
      matchesPlayed: 1, tied: 1, points: 1,
      runsFor: team2Runs, runsAgainst: team1Runs,
      oversFor: oversTeam2, oversAgainst: oversTeam1
    });
  } else if (isTie && isSuperOver && superOverWinnerId) {
    // Tie with super over - winner gets 2 points, loser gets 0
    // But for NRR, the main match runs/overs are used (super over doesn't count for NRR)
    const loserId = superOverWinnerId === team1Id ? team2Id : team1Id;
    
    updateTeamPoints(tournamentId, superOverWinnerId, { 
      matchesPlayed: 1, won: 1, points: 2,
      runsFor: superOverWinnerId === team1Id ? team1Runs : team2Runs, 
      runsAgainst: superOverWinnerId === team1Id ? team2Runs : team1Runs,
      oversFor: superOverWinnerId === team1Id ? oversTeam1 : oversTeam2, 
      oversAgainst: superOverWinnerId === team1Id ? oversTeam2 : oversTeam1
    });
    updateTeamPoints(tournamentId, loserId, { 
      matchesPlayed: 1, lost: 1, points: 0,
      runsFor: loserId === team1Id ? team1Runs : team2Runs, 
      runsAgainst: loserId === team1Id ? team2Runs : team1Runs,
      oversFor: loserId === team1Id ? oversTeam1 : oversTeam2, 
      oversAgainst: loserId === team1Id ? oversTeam2 : oversTeam1
    });
  } else if (isNoResult) {
    // Both teams get 1 point, no NRR impact
    updateTeamPoints(tournamentId, team1Id, { 
      matchesPlayed: 1, noResult: 1, points: 1 
    });
    updateTeamPoints(tournamentId, team2Id, { 
      matchesPlayed: 1, noResult: 1, points: 1 
    });
  } else if (winnerId) {
    const loserId = winnerId === team1Id ? team2Id : team1Id;
    const winnerRuns = winnerId === team1Id ? team1Runs : team2Runs;
    const winnerOvers = winnerId === team1Id ? oversTeam1 : oversTeam2;
    const loserRuns = winnerId === team1Id ? team2Runs : team1Runs;
    const loserOvers = winnerId === team1Id ? oversTeam2 : oversTeam1;
    
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
 * Recalculate Net Run Rate for all teams (ICC standard formula)
 * NRR = (Total Runs Scored / Total Overs Faced) - (Total Runs Conceded / Total Overs Bowled)
 */
const recalculateNRR = (tournamentId) => {
  const pointsTable = tournamentModel.findPointsTable(tournamentId);
  
  for (const entry of pointsTable) {
    const runsFor = entry.runs_for || 0;
    const runsAgainst = entry.runs_against || 0;
    const oversFor = parseFloat(entry.overs_for) || 0;
    const oversAgainst = parseFloat(entry.overs_against) || 0;
    
    // ICC Standard NRR calculation
    // Run Rate = Runs / Overs
    const runRateFor = oversFor > 0 ? runsFor / oversFor : 0;
    const runRateAgainst = oversAgainst > 0 ? runsAgainst / oversAgainst : 0;
    const nrr = runRateFor - runRateAgainst;
    
    tournamentModel.updatePointsTable(tournamentId, entry.team_id, { 
      netRunRate: parseFloat(nrr.toFixed(4))  // ICC uses 4 decimal places
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
 * Get points table for a tournament (sorted by points, then NRR)
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

/**
 * Find a valid new date for an abandoned match and reschedule it
 */
const rescheduleMatch = (tournamentId, matchId) => {
  const tournament = tournamentModel.findTournamentById(tournamentId);
  const match = matchModel.findById(matchId);
  const fixture = db.prepare('SELECT * FROM fixtures WHERE match_id = ?').get(matchId);
  
  if (!tournament || !match || !fixture) {
    throw new Error('Tournament, match, or fixture not found');
  }
  
  const team1Id = match.team1_id;
  const team2Id = match.team2_id;
  
  // Search for a new date within tournament range starting from tomorrow
  let candidateDate = new Date();
  candidateDate.setDate(candidateDate.getDate() + 1);
  const endDate = new Date(tournament.end_date);
  
  // Get all existing fixtures in this tournament to check for stadium usage
  const allFixtures = tournamentModel.findFixturesByTournament(tournamentId);
  const stadiumIds = tournamentModel.findAllStadiums().map(s => s.id);
  
  // Track stadium usage for each day
  const stadiumDayUsage = {};
  allFixtures.forEach(f => {
    if (f.stadium_id && f.match_date) {
      if (!stadiumDayUsage[f.stadium_id]) stadiumDayUsage[f.stadium_id] = new Set();
      stadiumDayUsage[f.stadium_id].add(f.match_date);
    }
  });

  let foundDate = null;
  let foundStadiumId = null;

  while (candidateDate <= endDate) {
    const dateStr = candidateDate.toISOString().split('T')[0];
    
    // Check 1-day gap for both teams using existing method
    const team1Dates = tournamentModel.findTeamMatchDates(tournamentId, team1Id);
    const team2Dates = tournamentModel.findTeamMatchDates(tournamentId, team2Id);
    
    let team1GapOk = true;
    for (const d of team1Dates) {
      if (!hasMinimumGap(d, candidateDate, 1)) {
        team1GapOk = false;
        break;
      }
    }
    
    let team2GapOk = true;
    for (const d of team2Dates) {
      if (!hasMinimumGap(d, candidateDate, 1)) {
        team2GapOk = false;
        break;
      }
    }
    
    if (team1GapOk && team2GapOk) {
      // Find a stadium not used on this day
      for (const sId of stadiumIds) {
        if (!stadiumDayUsage[sId] || !stadiumDayUsage[sId].has(dateStr)) {
          foundDate = dateStr;
          foundStadiumId = sId;
          break;
        }
      }
    }
    
    if (foundDate) break;
    candidateDate.setDate(candidateDate.getDate() + 1);
  }
  
  if (foundDate) {
    // Update match and fixture
    db.prepare('UPDATE matches SET scheduled_date = ?, status = ?, started_at = NULL, completed_at = NULL WHERE id = ?')
      .run(foundDate, 'scheduled', matchId);
    
    db.prepare('UPDATE fixtures SET match_date = ?, stadium_id = ? WHERE match_id = ?')
      .run(foundDate, foundStadiumId, matchId);
      
    return {
      matchId,
      newDate: foundDate,
      stadiumId: foundStadiumId
    };
  }
  
  return null; // Could not reschedule
};

/**
 * Record knockout match result and advance winner
 */
const recordKnockoutResult = (fixtureId, winnerId, isSuperOver = false) => {
  const fixture = tournamentModel.findFixtureById(fixtureId);
  if (!fixture) throw new Error('Fixture not found');
  
  // Update fixture with winner
  tournamentModel.updateFixture(fixtureId, { 
    winnerId,
    isSuperOver: isSuperOver ? 1 : 0
  });
  
  // If this was a semi-final, update the final fixture
  if (fixture.stage === STAGES.SEMI_FINAL) {
    const tournamentFixtures = tournamentModel.findFixturesByStage(fixture.tournament_id, STAGES.FINAL);
    if (tournamentFixtures.length > 0) {
      const finalFixture = tournamentFixtures[0];
      // Determine which position in the final
      if (fixture.stage_position === 1) {
        tournamentModel.updateFixture(finalFixture.id, { team1Id: winnerId });
      } else {
        tournamentModel.updateFixture(finalFixture.id, { team2Id: winnerId });
      }
    }
  }
  
  return tournamentModel.findFixtureById(fixtureId);
};

module.exports = {
  createTournament,
  updateTournament,
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
  removeTeamFromTournament,
  updateKnockoutFixtures,
  getQualifiedTeams,
  recordKnockoutResult,
  rescheduleMatch,
  STAGES
};
