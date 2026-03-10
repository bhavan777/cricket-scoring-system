/**
 * Cricket Rules Service for T20 Matches
 * Handles all cricket scoring rules and validations
 */

const BALL_TYPES = {
  NORMAL: 'normal',
  WIDE: 'wide',
  NO_BALL: 'no_ball',
  FREE_HIT: 'free_hit'
};

const DISMISSAL_TYPES = {
  BOWLED: 'bowled',
  CAUGHT: 'caught',
  LBW: 'lbw',
  RUN_OUT: 'run_out',
  STUMPED: 'stumped',
  HIT_WICKET: 'hit_wicket',
  HANDLED_BALL: 'handled_ball',
  OBSTRUCTING_FIELD: 'obstructing_field',
  HIT_TWICE: 'hit_twice',
  TIMED_OUT: 'timed_out'
};

const EXTRA_TYPES = {
  WIDE: 'wide',
  NO_BALL: 'no_ball',
  BYE: 'bye',
  LEG_BYE: 'leg_bye',
  PENALTY: 'penalty'
};

const T20_RULES = {
  MAX_OVERS_PER_BOWLER: 4,
  MAX_OVERS_PER_INNINGS: 20,
  MAX_BALLS_PER_OVER: 6,
  POWERPLAY_OVERS: 6, // First 6 overs
  MAX_FIELDERS_OUTSIDE_CIRCLE_NON_POWERPLAY: 5,
  MAX_FIELDERS_OUTSIDE_CIRCLE_POWERPLAY: 2
};

/**
 * Validates if a bowler can bowl more overs
 */
const canBowlerBowl = (currentOvers, maxOvers = T20_RULES.MAX_OVERS_PER_BOWLER) => {
  return currentOvers < maxOvers;
};

/**
 * Calculate over string from balls
 */
const calculateOvers = (totalBalls) => {
  const overs = Math.floor(totalBalls / 6);
  const balls = totalBalls % 6;
  return `${overs}.${balls}`;
};

/**
 * Get total balls from over string
 */
const getTotalBalls = (overString) => {
  const parts = overString.split('.');
  return parseInt(parts[0]) * 6 + parseInt(parts[1] || 0);
};

/**
 * Check if ball is a valid delivery (counts towards over)
 */
const isValidDelivery = (extraType) => {
  return !extraType || ![EXTRA_TYPES.WIDE, EXTRA_TYPES.NO_BALL].includes(extraType);
};

/**
 * Calculate runs including extras
 */
const calculateBallRuns = (runs, extraType, extraRuns = 0) => {
  let totalRuns = runs || 0;
  let extras = 0;
  
  if (extraType) {
    switch (extraType) {
      case EXTRA_TYPES.WIDE:
        extras = 1 + (runs || 0); // 1 for wide + any additional runs
        totalRuns = extras;
        break;
      case EXTRA_TYPES.NO_BALL:
        extras = 1 + (runs || 0); // 1 for no ball + runs scored
        totalRuns = extras;
        break;
      case EXTRA_TYPES.BYE:
      case EXTRA_TYPES.LEG_BYE:
        extras = runs || 0;
        totalRuns = extras;
        break;
      case EXTRA_TYPES.PENALTY:
        extras = runs || 0;
        totalRuns = extras;
        break;
    }
  }
  
  return { totalRuns, extras, runsFromBat: extraType ? 0 : (runs || 0) };
};

/**
 * Check if boundary
 */
const isBoundary = (runs) => {
  return runs === 4 || runs === 6;
};

/**
 * Get boundary type
 */
const getBoundaryType = (runs) => {
  if (runs === 4) return 'four';
  if (runs === 6) return 'six';
  return null;
};

/**
 * Check if innings is complete
 */
const isInningsComplete = (wickets, maxWickets = 10, overs, maxOvers = T20_RULES.MAX_OVERS_PER_INNINGS) => {
  return wickets >= maxWickets || getTotalBalls(overs) >= maxOvers * 6;
};

/**
 * Check if match is complete
 */
const isMatchComplete = (innings1Runs, innings1Complete, innings2Runs, innings2Wickets, innings2Complete) => {
  if (!innings1Complete) return false;
  if (innings2Complete) return true;
  
  // Second innings team has won
  if (innings2Runs > innings1Runs) return true;
  
  // Second innings team all out or overs finished
  if (innings2Complete) return true;
  
  return false;
};

/**
 * Determine match winner
 */
const getMatchWinner = (team1Id, team1Runs, team2Id, team2Runs, team2Wickets, innings2Complete) => {
  if (team1Runs > team2Runs) {
    return { winnerId: team1Id, margin: `${team1Runs - team2Runs} runs`, result: `${team1Id} won by ${team1Runs - team2Runs} runs` };
  } else if (team2Runs > team1Runs) {
    const wicketsRemaining = 10 - team2Wickets;
    return { winnerId: team2Id, margin: `${wicketsRemaining} wickets`, result: `${team2Id} won by ${wicketsRemaining} wickets` };
  } else {
    return { winnerId: null, margin: 'Tie', result: 'Match tied' };
  }
};

/**
 * Validate ball input
 */
const validateBallInput = (ballData) => {
  const errors = [];
  
  if (ballData.runs < 0 || ballData.runs > 7) {
    errors.push('Runs must be between 0 and 7');
  }
  
  if (ballData.extraType && !Object.values(EXTRA_TYPES).includes(ballData.extraType)) {
    errors.push(`Invalid extra type. Valid types: ${Object.values(EXTRA_TYPES).join(', ')}`);
  }
  
  if (ballData.isWicket && !Object.values(DISMISSAL_TYPES).includes(ballData.wicketType)) {
    errors.push(`Invalid dismissal type. Valid types: ${Object.values(DISMISSAL_TYPES).join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
};

module.exports = {
  BALL_TYPES,
  DISMISSAL_TYPES,
  EXTRA_TYPES,
  T20_RULES,
  canBowlerBowl,
  calculateOvers,
  getTotalBalls,
  isValidDelivery,
  calculateBallRuns,
  isBoundary,
  getBoundaryType,
  isInningsComplete,
  isMatchComplete,
  getMatchWinner,
  validateBallInput
};
