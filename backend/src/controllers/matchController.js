/**
 * Match Controller - Handles match scoring and statistics
 */

const scoringService = require('../services/scoringService');
const matchModel = require('../models/matchModel');
const teamModel = require('../models/teamModel');

// ============ Match Lifecycle ============

const startMatch = (req, res) => {
  try {
    const { team1Id, team2Id, scheduledDate, overs, tournamentId, fixtureId } = req.body;
    
    if (!team1Id || !team2Id) {
      return res.status(400).json({ success: false, error: 'Both team1Id and team2Id are required' });
    }
    
    if (team1Id === team2Id) {
      return res.status(400).json({ success: false, error: 'Teams must be different' });
    }
    
    // Verify teams exist
    const team1 = teamModel.findById(team1Id);
    const team2 = teamModel.findById(team2Id);
    
    if (!team1 || !team2) {
      return res.status(404).json({ success: false, error: 'One or both teams not found' });
    }
    
    const match = scoringService.startMatch(team1Id, team2Id, { scheduledDate, overs, tournamentId, fixtureId });
    res.status(201).json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const scheduleMatch = (req, res) => {
  try {
    const { team1Id, team2Id, scheduledDate, overs, tournamentId, fixtureId } = req.body;
    
    if (!team1Id || !team2Id || !scheduledDate) {
      return res.status(400).json({ success: false, error: 'team1Id, team2Id, and scheduledDate are required' });
    }
    
    if (team1Id === team2Id) {
      return res.status(400).json({ success: false, error: 'Teams must be different' });
    }
    
    // Verify teams exist
    const team1 = teamModel.findById(team1Id);
    const team2 = teamModel.findById(team2Id);
    
    if (!team1 || !team2) {
      return res.status(404).json({ success: false, error: 'One or both teams not found' });
    }
    
    const match = scoringService.scheduleMatch(team1Id, team2Id, scheduledDate, { overs, tournamentId, fixtureId });
    res.status(201).json({ success: true, data: match });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const startScheduledMatch = (req, res) => {
  try {
    const { matchId } = req.params;
    const match = scoringService.startScheduledMatch(matchId);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const delayMatch = (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    const match = scoringService.delayMatch(matchId, reason);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const applyDLS = (req, res) => {
  try {
    const { matchId } = req.params;
    const { revisedOvers } = req.body;
    
    if (!revisedOvers) {
      return res.status(400).json({ success: false, error: 'revisedOvers is required' });
    }
    
    const result = scoringService.applyDLS(matchId, revisedOvers);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const abandonMatch = (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    const match = scoringService.abandonMatch(matchId, reason);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const declareNoResult = (req, res) => {
  try {
    const { matchId } = req.params;
    const { reason } = req.body;
    const match = scoringService.declareNoResult(matchId, reason);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const completeMatch = (req, res) => {
  try {
    const { matchId } = req.params;
    const { winnerId } = req.body;
    
    if (!winnerId) {
      return res.status(400).json({ success: false, error: 'winnerId is required' });
    }
    
    const match = scoringService.completeMatch(matchId, winnerId);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const getMatchesByStatus = (req, res) => {
  try {
    const { status } = req.params;
    const matches = matchModel.findByStatus(status);
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============ Match Actions ============

const setTossResult = (req, res) => {
  try {
    const { matchId } = req.params;
    const { tossWinnerId, tossDecision } = req.body;
    
    if (!tossWinnerId || !tossDecision) {
      return res.status(400).json({ success: false, error: 'tossWinnerId and tossDecision are required' });
    }
    
    if (!['bat', 'bowl'].includes(tossDecision)) {
      return res.status(400).json({ success: false, error: 'tossDecision must be "bat" or "bowl"' });
    }
    
    const match = scoringService.setTossResult(matchId, tossWinnerId, tossDecision);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const initializeInnings = (req, res) => {
  try {
    const { matchId } = req.params;
    const { battingTeamId, bowlingTeamId, strikerId, nonStrikerId, bowlerId } = req.body;
    
    if (!battingTeamId || !bowlingTeamId || !strikerId || !nonStrikerId || !bowlerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'battingTeamId, bowlingTeamId, strikerId, nonStrikerId, and bowlerId are required' 
      });
    }
    
    const match = scoringService.initializeInnings(matchId, battingTeamId, bowlingTeamId, strikerId, nonStrikerId, bowlerId);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const recordBall = (req, res) => {
  try {
    const { matchId } = req.params;
    const ballData = req.body;
    
    const match = scoringService.recordBall(matchId, ballData);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const setNewBatsman = (req, res) => {
  try {
    const { matchId } = req.params;
    const { playerId } = req.body;
    
    if (!playerId) {
      return res.status(400).json({ success: false, error: 'playerId is required' });
    }
    
    const match = scoringService.setNewBatsman(matchId, playerId);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const setNewBowler = (req, res) => {
  try {
    const { matchId } = req.params;
    const { bowlerId } = req.body;
    
    if (!bowlerId) {
      return res.status(400).json({ success: false, error: 'bowlerId is required' });
    }
    
    const match = scoringService.setNewBowler(matchId, bowlerId);
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getMatchDetails = (req, res) => {
  try {
    const match = scoringService.getMatchDetails(req.params.matchId);
    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAllMatches = (req, res) => {
  try {
    const matches = matchModel.findAll();
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBatsmanStats = (req, res) => {
  try {
    const { inningsId } = req.params;
    const stats = matchModel.findBatsmanStatsByInningsId(inningsId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBowlerStats = (req, res) => {
  try {
    const { inningsId } = req.params;
    const stats = matchModel.findBowlerStatsByInningsId(inningsId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getFallOfWickets = (req, res) => {
  try {
    const { inningsId } = req.params;
    const wickets = matchModel.findFallOfWicketsByInningsId(inningsId);
    res.json({ success: true, data: wickets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBallByBall = (req, res) => {
  try {
    const { inningsId } = req.params;
    const balls = matchModel.findBallsByInningsId(inningsId);
    res.json({ success: true, data: balls });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  // Match lifecycle
  startMatch,
  scheduleMatch,
  startScheduledMatch,
  delayMatch,
  applyDLS,
  abandonMatch,
  declareNoResult,
  completeMatch,
  getMatchesByStatus,
  
  // Match actions
  setTossResult,
  initializeInnings,
  recordBall,
  setNewBatsman,
  setNewBowler,
  getMatchDetails,
  getAllMatches,
  getBatsmanStats,
  getBowlerStats,
  getFallOfWickets,
  getBallByBall
};
