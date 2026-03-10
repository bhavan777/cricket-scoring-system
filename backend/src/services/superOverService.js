/**
 * Super Over Service - Handles Super Over for tied matches
 * 
 * ICC Super Over Rules:
 * 1. Each team bats one over (6 legal deliveries)
 * 2. Team that scored more runs wins
 * 3. If tied again, another super over is played (until a winner is decided)
 * 4. In ICC events, if super over is tied, boundary count from super over decides
 * 5. If still tied, boundary count from the entire match decides
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const sseService = require('./sseService');
const matchModel = require('../models/matchModel');
const teamModel = require('../models/teamModel');

/**
 * Start a Super Over for a tied match
 */
const startSuperOver = (matchId, battingTeamId, bowlingTeamId, strikerId, nonStrikerId, bowlerId) => {
  // Verify match exists and is in a tied state
  const match = matchModel.findById(matchId);
  if (!match) throw new Error('Match not found');
  
  // Get current super over number
  const existingSuperOvers = db.prepare(`
    SELECT MAX(super_over_number) as max_so 
    FROM super_overs 
    WHERE match_id = ?
  `).get(matchId);
  
  const superOverNumber = (existingSuperOvers?.max_so || 0) + 1;
  
  // Create super over record
  const superOverId = `so-${uuidv4()}`;
  db.prepare(`
    INSERT INTO super_overs (id, match_id, super_over_number, batting_team_id, bowling_team_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(superOverId, matchId, superOverNumber, battingTeamId, bowlingTeamId);
  
  // Update match state for super over
  db.prepare(`
    UPDATE match_state 
    SET striker_id = ?, non_striker_id = ?, current_bowler_id = ?,
        current_over = 0, current_ball = 0
    WHERE match_id = ?
  `).run(strikerId, nonStrikerId, bowlerId, matchId);
  
  // Broadcast super over start
  sseService.broadcastUpdate(matchId, 'super_over_started', {
    matchId,
    superOverId,
    superOverNumber,
    battingTeamId,
    bowlingTeamId
  });
  
  return {
    id: superOverId,
    matchId,
    superOverNumber,
    battingTeamId,
    bowlingTeamId,
    totalRuns: 0,
    totalWickets: 0,
    isComplete: false
  };
};

/**
 * Record a ball in Super Over
 */
const recordSuperOverBall = (superOverId, ballData) => {
  const { 
    batsmanId, 
    bowlerId, 
    runs = 0, 
    isWicket = false, 
    extraType = null, 
    extraRuns = 0 
  } = ballData;
  
  const superOver = db.prepare('SELECT * FROM super_overs WHERE id = ?').get(superOverId);
  if (!superOver) throw new Error('Super over not found');
  if (superOver.is_complete) throw new Error('Super over already completed');
  
  // Get current ball number
  const existingBalls = db.prepare(`
    SELECT COUNT(*) as count 
    FROM super_over_balls 
    WHERE super_over_id = ?
  `).get(superOverId);
  
  // For super over, we count legal deliveries (no wides/no balls for ball count)
  const isLegalDelivery = !extraType || !['wide', 'no_ball'].includes(extraType);
  let ballNumber = existingBalls.count + 1;
  
  // Calculate total runs
  const totalRuns = runs + (extraRuns || 0);
  
  // Create ball record
  const ballId = `sob-${uuidv4()}`;
  db.prepare(`
    INSERT INTO super_over_balls (id, super_over_id, ball_number, batsman_id, bowler_id, 
      runs_scored, is_wicket, extra_type, extra_runs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ballId, superOverId, ballNumber, batsmanId, bowlerId, 
    totalRuns, isWicket ? 1 : 0, extraType, extraRuns || 0);
  
  // Update super over totals
  const newRuns = superOver.total_runs + totalRuns;
  const newWickets = superOver.total_wickets + (isWicket ? 1 : 0);
  
  db.prepare(`
    UPDATE super_overs 
    SET total_runs = ?, total_wickets = ?
    WHERE id = ?
  `).run(newRuns, newWickets, superOverId);
  
  // Check if super over is complete
  // Complete if: 6 legal deliveries OR 2 wickets (in T20 super over)
  const legalDeliveries = db.prepare(`
    SELECT COUNT(*) as count 
    FROM super_over_balls 
    WHERE super_over_id = ? AND (extra_type IS NULL OR extra_type NOT IN ('wide', 'no_ball'))
  `).get(superOverId).count;
  
  const isComplete = legalDeliveries >= 6 || newWickets >= 2;
  
  if (isComplete) {
    db.prepare('UPDATE super_overs SET is_complete = 1 WHERE id = ?').run(superOverId);
  }
  
  return {
    ballId,
    ballNumber,
    runs: totalRuns,
    isWicket,
    isLegalDelivery,
    superOverComplete: isComplete,
    superOverStats: {
      totalRuns: newRuns,
      totalWickets: newWickets,
      legalDeliveries
    }
  };
};

/**
 * Get Super Over result
 */
const getSuperOverResult = (matchId) => {
  const superOvers = db.prepare(`
    SELECT so.*, 
           bt.name as batting_team_name, bt.short_name as batting_team_short,
           bl.name as bowling_team_name, bl.short_name as bowling_team_short
    FROM super_overs so
    JOIN teams bt ON so.batting_team_id = bt.id
    JOIN teams bl ON so.bowling_team_id = bl.id
    WHERE so.match_id = ?
    ORDER BY so.super_over_number
  `).all(matchId);
  
  return superOvers.map(so => {
    const balls = db.prepare(`
      SELECT sob.*, p.name as batsman_name, pb.name as bowler_name
      FROM super_over_balls sob
      JOIN players p ON sob.batsman_id = p.id
      JOIN players pb ON sob.bowler_id = pb.id
      WHERE sob.super_over_id = ?
      ORDER BY sob.ball_number
    `).all(so.id);
    
    return {
      ...so,
      balls
    };
  });
};

/**
 * Determine Super Over winner
 * Returns winner team ID or null if still tied
 */
const determineSuperOverWinner = (matchId) => {
  const superOvers = db.prepare(`
    SELECT * FROM super_overs WHERE match_id = ? ORDER BY super_over_number DESC
  `).all(matchId);
  
  if (superOvers.length === 0) return null;
  
  // Get the latest super over pair (both teams bat)
  const latestNumber = superOvers[0].super_over_number;
  const latestPair = superOvers.filter(so => so.super_over_number === latestNumber);
  
  if (latestPair.length < 2) {
    // Only one team has batted in this super over
    return null;
  }
  
  const team1SO = latestPair[0];
  const team2SO = latestPair[1];
  
  // Compare runs
  if (team1SO.total_runs > team2SO.total_runs) {
    return team1SO.batting_team_id;
  } else if (team2SO.total_runs > team1SO.total_runs) {
    return team2SO.batting_team_id;
  }
  
  // Tied on runs - check boundary count in super over
  const team1Boundaries = countBoundariesInSuperOver(team1SO.id);
  const team2Boundaries = countBoundariesInSuperOver(team2SO.id);
  
  if (team1Boundaries > team2Boundaries) {
    return team1SO.batting_team_id;
  } else if (team2Boundaries > team1Boundaries) {
    return team2SO.batting_team_id;
  }
  
  // Still tied - check boundary count from entire match
  const match = matchModel.findById(matchId);
  const team1MatchBoundaries = countMatchBoundaries(matchId, team1SO.batting_team_id);
  const team2MatchBoundaries = countMatchBoundaries(matchId, team2SO.batting_team_id);
  
  if (team1MatchBoundaries > team2MatchBoundaries) {
    return team1SO.batting_team_id;
  } else if (team2MatchBoundaries > team1MatchBoundaries) {
    return team2SO.batting_team_id;
  }
  
  // Still tied - this would require another super over
  return null;  // Indicates need for another super over
};

/**
 * Count boundaries in a super over
 */
const countBoundariesInSuperOver = (superOverId) => {
  const balls = db.prepare(`
    SELECT runs_scored FROM super_over_balls WHERE super_over_id = ?
  `).all(superOverId);
  
  return balls.filter(b => b.runs_scored >= 4).length;
};

/**
 * Count boundaries for a team in the entire match
 */
const countMatchBoundaries = (matchId, teamId) => {
  // Count boundaries from balls where this team was batting
  const innings = db.prepare(`
    SELECT id FROM innings WHERE match_id = ? AND batting_team_id = ?
  `).all(matchId, teamId);
  
  let totalBoundaries = 0;
  for (const ing of innings) {
    const balls = db.prepare(`
      SELECT COUNT(*) as count FROM balls 
      WHERE innings_id = ? AND is_boundary = 1
    `).get(ing.id);
    totalBoundaries += balls?.count || 0;
  }
  
  return totalBoundaries;
};

/**
 * Complete super over sequence and declare winner
 */
const completeSuperOverSequence = (matchId, winnerId) => {
  // Update match with winner
  db.prepare(`
    UPDATE matches 
    SET status = 'completed', winner_id = ?, completed_at = ?
    WHERE id = ?
  `).run(winnerId, new Date().toISOString(), matchId);
  
  // Broadcast completion
  sseService.broadcastUpdate(matchId, 'super_over_complete', {
    matchId,
    winnerId,
    superOvers: getSuperOverResult(matchId)
  });
  
  return {
    matchId,
    winnerId,
    completed: true
  };
};

/**
 * Get super over state for UI
 */
const getSuperOverState = (matchId) => {
  const superOvers = getSuperOverResult(matchId);
  
  if (superOvers.length === 0) return null;
  
  const latestSO = superOvers[superOvers.length - 1];
  const matchState = matchModel.findMatchState(matchId);
  
  return {
    matchId,
    currentSuperOver: latestSO,
    allSuperOvers: superOvers,
    currentState: matchState
  };
};

module.exports = {
  startSuperOver,
  recordSuperOverBall,
  getSuperOverResult,
  determineSuperOverWinner,
  completeSuperOverSequence,
  getSuperOverState
};
