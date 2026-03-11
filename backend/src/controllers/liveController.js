/**
 * Live Controller - Handles SSE and live match summaries
 */

const sseService = require('../services/sseService');
const scoringService = require('../services/scoringService');
const matchModel = require('../models/matchModel');

const handleLiveEvents = (req, res) => {
  const { matchId } = req.params;
  
  // Setup SSE
  sseService.setupSSE(res);
  sseService.sendConnectionMessage(res);
  
  // Add client to broadcast list
  sseService.addClient(matchId, res);
  
  // Send current match state
  try {
    const matchDetails = scoringService.getMatchDetails(matchId);
    if (matchDetails) {
      res.write(`event: initial_state\ndata: ${JSON.stringify(matchDetails)}\n\n`);
    }
  } catch (error) {
    console.error('Error sending initial state:', error);
  }
  
  // Handle client disconnect
  req.on('close', () => {
    sseService.removeClient(matchId, res);
  });
};

const getMatchSummary = (req, res) => {
  try {
    const { matchId } = req.params;
    const match = scoringService.getMatchDetails(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }
    
    // Build simplified summary
    const summary = {
      matchId: match.id,
      status: match.status,
      team1: {
        id: match.team1.id,
        name: match.team1.name,
        shortName: match.team1.short_name
      },
      team2: {
        id: match.team2.id,
        name: match.team2.name,
        shortName: match.team2.short_name
      },
      toss: {
        winner: match.toss_winner_id,
        decision: match.toss_decision
      },
      currentInnings: match.current_innings,
      innings: []
    };
    
    // Add innings data
    for (const ing of match.innings) {
      const batsmen = matchModel.findBatsmanStatsByInningsId(ing.id);
      const bowlers = matchModel.findBowlerStatsByInningsId(ing.id);
      const currentBatsmen = batsmen.filter(b => !b.is_out);
      
      const inningsData = {
        inningsNumber: ing.innings_number,
        battingTeam: {
          id: ing.battingTeam.id,
          name: ing.battingTeam.name
        },
        bowlingTeam: {
          id: ing.bowlingTeam.id,
          name: ing.bowlingTeam.name
        },
        score: {
          runs: ing.total_runs,
          wickets: ing.total_wickets,
          overs: ing.total_overs,
          extras: ing.extras
        },
        isComplete: ing.is_complete === 1,
        currentBatsmen: currentBatsmen.map(b => ({
          id: b.player_id,
          name: b.name,
          runs: b.runs,
          balls: b.balls_faced,
          fours: b.fours,
          sixes: b.sixes,
          isOnStrike: b.is_on_strike === 1
        })),
        currentBowler: bowlers.length > 0 ? {
          id: bowlers[0].player_id,
          name: bowlers[0].name,
          overs: bowlers[0].overs,
          runs: bowlers[0].runs_conceded,
          wickets: bowlers[0].wickets,
          maidens: bowlers[0].maidens
        } : null,
        topScorers: batsmen
          .filter(b => b.runs > 0)
          .sort((a, b) => b.runs - a.runs)
          .slice(0, 3)
          .map(b => ({
            name: b.name,
            runs: b.runs,
            balls: b.balls_faced
          })),
        topBowlers: bowlers
          .filter(b => b.wickets > 0 || b.runs_conceded > 0)
          .sort((a, b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded)
          .slice(0, 3)
          .map(b => ({
            name: b.name,
            wickets: b.wickets,
            runs: b.runs_conceded,
            overs: b.overs
          }))
      };
      
      summary.innings.push(inningsData);
    }
    
    // Add current state
    if (match.currentState) {
      summary.currentBall = {
        over: match.currentState.current_over,
        ball: match.currentState.current_ball,
        striker: match.currentState.striker_id,
        nonStriker: match.currentState.non_striker_id,
        bowler: match.currentState.current_bowler_id
      };
    }
    
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getPlayerStats = (req, res) => {
  try {
    const { playerId } = req.params;
    
    const battingStats = matchModel.findPlayerBattingStats(playerId);
    const bowlingStats = matchModel.findPlayerBowlingStats(playerId);
    
    res.json({ 
      success: true, 
      data: { 
        batting: battingStats,
        bowling: bowlingStats
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  handleLiveEvents,
  getMatchSummary,
  getPlayerStats
};
