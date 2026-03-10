/**
 * Scoring Service - Handles all ball-by-ball scoring operations
 */

const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const cricketRules = require('./cricketRules');
const sseService = require('./sseService');
const matchModel = require('../models/matchModel');
const teamModel = require('../models/teamModel');

/**
 * Start a new match
 */
const startMatch = (team1Id, team2Id) => {
  const matchId = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO matches (id, team1_id, team2_id, status, started_at)
    VALUES (?, ?, ?, 'in_progress', ?)
  `);
  
  stmt.run(matchId, team1Id, team2Id, now);
  
  // Initialize match state
  const stateStmt = db.prepare(`
    INSERT INTO match_state (match_id, current_innings, current_over, current_ball)
    VALUES (?, 1, 0, 0)
  `);
  stateStmt.run(matchId);
  
  return getMatchDetails(matchId);
};

/**
 * Set toss result
 */
const setTossResult = (matchId, tossWinnerId, tossDecision) => {
  const stmt = db.prepare(`
    UPDATE matches 
    SET toss_winner_id = ?, toss_decision = ?
    WHERE id = ?
  `);
  
  stmt.run(tossWinnerId, tossDecision, matchId);
  
  return getMatchDetails(matchId);
};

/**
 * Initialize first innings
 */
const initializeInnings = (matchId, battingTeamId, bowlingTeamId, strikerId, nonStrikerId, bowlerId) => {
  const match = matchModel.findById(matchId);
  if (!match) throw new Error('Match not found');
  
  const inningsNumber = match.current_innings || 1;
  
  // Check if innings already exists to avoid duplication
  let inningsId = "";
  const existingInnings = db.prepare('SELECT id FROM innings WHERE match_id = ? AND innings_number = ?').get(matchId, inningsNumber);
  
  if (existingInnings) {
    inningsId = existingInnings.id;
  } else {
    inningsId = uuidv4();
    const inningsStmt = db.prepare(`
      INSERT INTO innings (id, match_id, innings_number, batting_team_id, bowling_team_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    inningsStmt.run(inningsId, matchId, inningsNumber, battingTeamId, bowlingTeamId);
  }
  
  // Create batsman innings for openers if they don't exist
  upsertBatsmanInnings(matchId, inningsId, strikerId, 1, true);
  upsertBatsmanInnings(matchId, inningsId, nonStrikerId, 2, false);
  
  // Create bowler innings if it doesn't exist
  upsertBowlerInnings(matchId, inningsId, bowlerId);
  
  // Update match state
  const stateStmt = db.prepare(`
    UPDATE match_state 
    SET striker_id = ?, non_striker_id = ?, current_bowler_id = ?, current_innings = ?, current_over = 0, current_ball = 0
    WHERE match_id = ?
  `);
  stateStmt.run(strikerId, nonStrikerId, bowlerId, inningsNumber, matchId);
  
  return getMatchDetails(matchId);
};

/**
 * Upsert batsman innings record
 */
const upsertBatsmanInnings = (matchId, inningsId, playerId, position, isOnStrike) => {
  const existing = db.prepare('SELECT id FROM batsman_innings WHERE innings_id = ? AND player_id = ?').get(inningsId, playerId);
  if (existing) {
    db.prepare('UPDATE batsman_innings SET is_on_strike = ? WHERE id = ?').run(isOnStrike ? 1 : 0, existing.id);
    return;
  }
  
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO batsman_innings (id, match_id, innings_id, player_id, batting_position, is_on_strike)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, matchId, inningsId, playerId, position, isOnStrike ? 1 : 0);
};

/**
 * Upsert bowler innings record
 */
const upsertBowlerInnings = (matchId, inningsId, playerId) => {
  const existing = db.prepare('SELECT id FROM bowler_innings WHERE innings_id = ? AND player_id = ?').get(inningsId, playerId);
  if (existing) return;
  
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO bowler_innings (id, match_id, innings_id, player_id)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, matchId, inningsId, playerId);
};

/**
 * Record a ball
 */
const recordBall = (matchId, ballData) => {
  const { 
    runs = 0, 
    extraType = null, 
    extraRuns = 0,
    isWicket = false, 
    wicketType = null, 
    dismissedPlayerId = null,
    fielderId = null
  } = ballData;
  
  // Validate input
  const validation = cricketRules.validateBallInput(ballData);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // Get current match state
  const matchState = matchModel.findMatchState(matchId);
  const innings = matchModel.findCurrentInnings(matchId);
  
  if (!innings) throw new Error('Innings not initialized');
  
  // Calculate runs
  const { totalRuns, extras, runsFromBat } = cricketRules.calculateBallRuns(runs, extraType, extraRuns);
  
  // Determine if this is a valid delivery
  const isValidDelivery = cricketRules.isValidDelivery(extraType);
  
  // Get current ball position
  let currentOver = matchState.current_over;
  let currentBall = matchState.current_ball;
  
  // Calculate new ball position
  let newOver = currentOver;
  let newBall = currentBall;
  
  if (isValidDelivery) {
    newBall++;
    if (newBall > 6) {
      newOver++;
      newBall = 0; // Reset to 0 for next over start
    }
  }
  
  // Create ball record
  const ballId = uuidv4();
  const ballStmt = db.prepare(`
    INSERT INTO balls (
      id, match_id, innings_id, over_number, ball_number,
      batsman_id, non_striker_id, bowler_id,
      runs_scored, extras, extra_type,
      is_wicket, wicket_type, dismissed_player_id,
      is_boundary, boundary_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const isBoundary = cricketRules.isBoundary(runs);
  const boundaryType = cricketRules.getBoundaryType(runs);
  
  ballStmt.run(
    ballId, matchId, innings.id, 
    isValidDelivery && newBall === 0 ? newOver - 1 : newOver, 
    isValidDelivery && newBall === 0 ? 6 : newBall,
    matchState.striker_id, matchState.non_striker_id, matchState.current_bowler_id,
    runsFromBat, extras, extraType,
    isWicket ? 1 : 0, wicketType, dismissedPlayerId,
    isBoundary ? 1 : 0, boundaryType
  );
  
  // Update batsman stats
  updateBatsmanStats(innings.id, matchState.striker_id, runsFromBat, isValidDelivery, isBoundary, boundaryType);
  
  // Update bowler stats
  updateBowlerStats(innings.id, matchState.current_bowler_id, totalRuns, isValidDelivery, isWicket, extraType);
  
  // Update innings totals
  updateInningsTotals(innings.id, totalRuns, isWicket, isValidDelivery);
  
  // Handle wicket
  if (isWicket) {
    handleWicket(matchId, innings.id, matchState.striker_id, wicketType, matchState.current_bowler_id, fielderId);
  }
  
  // Handle strike rotation
  let newStrikerId = matchState.striker_id;
  let newNonStrikerId = matchState.non_striker_id;
  
  // Rotate strike on odd runs or end of over
  if (!isWicket) {
    if (runs % 2 === 1) {
      [newStrikerId, newNonStrikerId] = [newNonStrikerId, newStrikerId];
      swapStrike(innings.id, newStrikerId, newNonStrikerId);
    }
    // End of over - rotate strike
    if (newBall === 0 && isValidDelivery) {
      [newStrikerId, newNonStrikerId] = [newNonStrikerId, newStrikerId];
      swapStrike(innings.id, newStrikerId, newNonStrikerId);
    }
  }
  
  // Update match state
  updateMatchState(matchId, newOver, newBall, newStrikerId, newNonStrikerId, matchState.current_bowler_id);
  
  // Check if innings is complete
  const updatedInnings = matchModel.findCurrentInnings(matchId);
  const inningsBalls = cricketRules.getTotalBalls(updatedInnings.total_overs);
  
  if (updatedInnings.total_wickets >= 10 || inningsBalls >= cricketRules.T20_RULES.MAX_OVERS_PER_INNINGS * 6) {
    completeInnings(matchId, innings.id);
  }
  
  // Get updated match details and broadcast
  const matchDetails = getMatchDetails(matchId);
  
  // Broadcast live update
  sseService.broadcastUpdate(matchId, 'ball_recorded', {
    matchId,
    ball: {
      over: newOver,
      ball: newBall,
      runs: totalRuns,
      extraType,
      isWicket,
      batsman: matchState.striker_id,
      bowler: matchState.current_bowler_id
    },
    matchState: matchDetails
  });
  
  return matchDetails;
};

/**
 * Update batsman stats
 */
const updateBatsmanStats = (inningsId, playerId, runs, isValidDelivery, isBoundary, boundaryType) => {
  const stmt = db.prepare(`
    UPDATE batsman_innings 
    SET runs = runs + ?, 
        balls_faced = balls_faced + ?,
        fours = fours + ?,
        sixes = sixes + ?
    WHERE innings_id = ? AND player_id = ?
  `);
  
  stmt.run(
    runs, 
    isValidDelivery ? 1 : 0,
    boundaryType === 'four' ? 1 : 0,
    boundaryType === 'six' ? 1 : 0,
    inningsId, 
    playerId
  );
};

/**
 * Update bowler stats
 */
const updateBowlerStats = (inningsId, playerId, runsConceded, isValidDelivery, isWicket, extraType) => {
  // Get current bowler stats
  const current = db.prepare(`
    SELECT balls, runs_conceded, wides, no_balls, wickets 
    FROM bowler_innings 
    WHERE innings_id = ? AND player_id = ?
  `).get(inningsId, playerId);
  
  if (!current) {
    upsertBowlerInnings(null, inningsId, playerId);
  }
  
  const newBalls = (current?.balls || 0) + (isValidDelivery ? 1 : 0);
  const overs = `${Math.floor(newBalls / 6)}.${newBalls % 6}`;
  
  const stmt = db.prepare(`
    UPDATE bowler_innings 
    SET balls = ?, 
        overs = ?,
        runs_conceded = runs_conceded + ?,
        wides = wides + ?,
        no_balls = no_balls + ?,
        wickets = wickets + ?
    WHERE innings_id = ? AND player_id = ?
  `);
  
  stmt.run(
    newBalls,
    overs,
    runsConceded,
    extraType === 'wide' ? 1 : 0,
    extraType === 'no_ball' ? 1 : 0,
    isWicket ? 1 : 0,
    inningsId,
    playerId
  );
};

/**
 * Update innings totals
 */
const updateInningsTotals = (inningsId, runs, isWicket, isValidDelivery) => {
  // Get current innings
  const innings = db.prepare('SELECT total_overs, total_wickets FROM innings WHERE id = ?').get(inningsId);
  
  // Calculate new overs
  const currentBalls = cricketRules.getTotalBalls(innings.total_overs);
  const newBalls = currentBalls + (isValidDelivery ? 1 : 0);
  const newOvers = cricketRules.calculateOvers(newBalls);
  
  const stmt = db.prepare(`
    UPDATE innings 
    SET total_runs = total_runs + ?,
        total_wickets = total_wickets + ?,
        total_overs = ?
    WHERE id = ?
  `);
  
  stmt.run(runs, isWicket ? 1 : 0, newOvers, inningsId);
};

/**
 * Handle wicket
 */
const handleWicket = (matchId, inningsId, dismissedPlayerId, wicketType, bowlerId, fielderId) => {
  // Update batsman innings
  const stmt = db.prepare(`
    UPDATE batsman_innings 
    SET is_out = 1, 
        dismissal_type = ?,
        dismissed_by = ?,
        fielder_id = ?
    WHERE innings_id = ? AND player_id = ?
  `);
  stmt.run(wicketType, bowlerId, fielderId, inningsId, dismissedPlayerId);
  
  // Record fall of wicket
  const innings = db.prepare('SELECT total_runs, total_overs, total_wickets FROM innings WHERE id = ?').get(inningsId);
  const fowId = uuidv4();
  const fowStmt = db.prepare(`
    INSERT INTO fall_of_wickets (id, match_id, innings_id, wicket_number, runs_at_dismissal, overs_at_dismissal, dismissed_player_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  fowStmt.run(fowId, matchId, inningsId, innings.total_wickets + 1, innings.total_runs, innings.total_overs, dismissedPlayerId);
};

/**
 * Swap strike
 */
const swapStrike = (inningsId, newStrikerId, newNonStrikerId) => {
  db.prepare(`UPDATE batsman_innings SET is_on_strike = 0 WHERE innings_id = ?`).run(inningsId);
  db.prepare(`UPDATE batsman_innings SET is_on_strike = 1 WHERE innings_id = ? AND player_id = ?`).run(inningsId, newStrikerId);
};

/**
 * Update match state
 */
const updateMatchState = (matchId, over, ball, strikerId, nonStrikerId, bowlerId) => {
  const stmt = db.prepare(`
    UPDATE match_state 
    SET current_over = ?, current_ball = ?, striker_id = ?, non_striker_id = ?, current_bowler_id = ?
    WHERE match_id = ?
  `);
  stmt.run(over, ball, strikerId, nonStrikerId, bowlerId, matchId);
};

/**
 * Complete innings
 */
const completeInnings = (matchId, inningsId) => {
  db.prepare(`UPDATE innings SET is_complete = 1 WHERE id = ?`).run(inningsId);
  
  const match = matchModel.findById(matchId);
  
  if (match.current_innings === 1) {
    // Start second innings
    db.prepare(`UPDATE matches SET current_innings = 2 WHERE id = ?`).run(matchId);
    db.prepare(`UPDATE match_state SET current_innings = 2, current_over = 0, current_ball = 0 WHERE match_id = ?`).run(matchId);
    
    sseService.broadcastUpdate(matchId, 'innings_complete', {
      matchId,
      inningsNumber: 1,
      matchState: getMatchDetails(matchId)
    });
  } else {
    // Match complete
    db.prepare(`UPDATE matches SET status = 'completed', completed_at = ? WHERE id = ?`).run(new Date().toISOString(), matchId);
    
    sseService.broadcastUpdate(matchId, 'match_complete', {
      matchId,
      matchState: getMatchDetails(matchId)
    });
  }
};

/**
 * Get match details
 */
const getMatchDetails = (matchId) => {
  const match = matchModel.findById(matchId);
  if (!match) return null;
  
  const team1 = teamModel.findById(match.team1_id);
  const team2 = teamModel.findById(match.team2_id);
  
  const innings = matchModel.findInningsByMatchId(matchId);
  
  const matchState = matchModel.findMatchState(matchId);
  
  return {
    ...match,
    team1,
    team2,
    innings: innings.map(ing => ({
      ...ing,
      battingTeam: teamModel.findById(ing.batting_team_id),
      bowlingTeam: teamModel.findById(ing.bowling_team_id)
    })),
    currentState: matchState
  };
};

/**
 * Set new batsman after wicket
 */
const setNewBatsman = (matchId, playerId) => {
  const innings = matchModel.findCurrentInnings(matchId);
  
  // Get next batting position
  const lastPosition = db.prepare(`
    SELECT MAX(batting_position) as max_pos 
    FROM batsman_innings 
    WHERE innings_id = ?
  `).get(innings.id);
  
  const newPosition = (lastPosition.max_pos || 0) + 1;
  
  upsertBatsmanInnings(matchId, innings.id, playerId, newPosition, true);
  
  // Update match state
  db.prepare(`
    UPDATE match_state SET striker_id = ? WHERE match_id = ?
  `).run(playerId, matchId);
  
  return getMatchDetails(matchId);
};

/**
 * Set new bowler
 */
const setNewBowler = (matchId, bowlerId) => {
  const innings = matchModel.findCurrentInnings(matchId);
  if (!innings) throw new Error('Innings not initialized');
  
  // T20 Restriction: Max 4 overs per bowler
  const bowlerStats = db.prepare(`
    SELECT overs FROM bowler_innings WHERE innings_id = ? AND player_id = ?
  `).get(innings.id, bowlerId);
  
  if (bowlerStats && parseFloat(bowlerStats.overs) >= 4) {
    throw new Error('Bowler has already completed maximum 4 overs allowed in T20');
  }
  
  // T20 Restriction: Cannot bowl consecutive overs
  const matchState = matchModel.findMatchState(matchId);
  if (matchState.current_bowler_id === bowlerId && matchState.current_ball === 0 && matchState.current_over > 0) {
    throw new Error('Bowler cannot bowl consecutive overs');
  }
  
  // Check if bowler already has an entry
  upsertBowlerInnings(matchId, innings.id, bowlerId);
  
  // Update match state
  db.prepare(`
    UPDATE match_state SET current_bowler_id = ? WHERE match_id = ?
  `).run(bowlerId, matchId);
  
  return getMatchDetails(matchId);
};

module.exports = {
  startMatch,
  setTossResult,
  initializeInnings,
  recordBall,
  getMatchDetails,
  setNewBatsman,
  setNewBowler,
  completeInnings
};
