/**
 * Match Model - Handles data access for matches, innings, and balls
 */

const { db } = require('../database');

const findAll = () => {
  return db.prepare('SELECT * FROM matches ORDER BY created_at DESC').all();
};

const findById = (id) => {
  return db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
};

const findInningsByMatchId = (matchId) => {
  return db.prepare('SELECT * FROM innings WHERE match_id = ? ORDER BY innings_number').all(matchId);
};

const findCurrentInnings = (matchId) => {
  const match = db.prepare('SELECT current_innings FROM matches WHERE id = ?').get(matchId);
  if (!match) return null;
  return db.prepare('SELECT * FROM innings WHERE match_id = ? AND innings_number = ?').get(matchId, match.current_innings);
};

const findMatchState = (matchId) => {
  return db.prepare('SELECT * FROM match_state WHERE match_id = ?').get(matchId);
};

const findBatsmanStatsByInningsId = (inningsId) => {
  return db.prepare(`
    SELECT bi.*, p.name, p.role, p.batting_style
    FROM batsman_innings bi
    JOIN players p ON bi.player_id = p.id
    WHERE bi.innings_id = ?
    ORDER BY bi.batting_position
  `).all(inningsId);
};

const findBowlerStatsByInningsId = (inningsId) => {
  return db.prepare(`
    SELECT boi.*, p.name, p.role, p.bowling_style
    FROM bowler_innings boi
    JOIN players p ON boi.player_id = p.id
    WHERE boi.innings_id = ?
    ORDER BY boi.overs DESC
  `).all(inningsId);
};

const findFallOfWicketsByInningsId = (inningsId) => {
  return db.prepare(`
    SELECT fow.*, p.name as dismissed_player_name
    FROM fall_of_wickets fow
    JOIN players p ON fow.dismissed_player_id = p.id
    WHERE fow.innings_id = ?
    ORDER BY fow.wicket_number
  `).all(inningsId);
};

const findBallsByInningsId = (inningsId) => {
  return db.prepare(`
    SELECT b.*, 
           pb.name as batsman_name,
           pn.name as non_striker_name,
           pbow.name as bowler_name
    FROM balls b
    JOIN players pb ON b.batsman_id = pb.id
    JOIN players pn ON b.non_striker_id = pn.id
    JOIN players pbow ON b.bowler_id = pbow.id
    WHERE b.innings_id = ?
    ORDER BY b.over_number, b.ball_number
  `).all(inningsId);
};

const findPlayerBattingStats = (playerId) => {
  return db.prepare(`
    SELECT 
      COUNT(*) as innings,
      SUM(runs) as total_runs,
      SUM(balls_faced) as total_balls,
      SUM(fours) as total_fours,
      SUM(sixes) as total_sixes,
      SUM(CASE WHEN is_out = 0 THEN 1 ELSE 0 END) as not_outs
    FROM batsman_innings 
    WHERE player_id = ?
  `).get(playerId);
};

const findPlayerBowlingStats = (playerId) => {
  return db.prepare(`
    SELECT 
      COUNT(*) as innings,
      SUM(wickets) as total_wickets,
      SUM(runs_conceded) as total_runs,
      SUM(balls) as total_balls,
      SUM(maidens) as total_maidens
    FROM bowler_innings 
    WHERE player_id = ?
  `).get(playerId);
};

module.exports = {
  findAll,
  findById,
  findInningsByMatchId,
  findCurrentInnings,
  findMatchState,
  findBatsmanStatsByInningsId,
  findBowlerStatsByInningsId,
  findFallOfWicketsByInningsId,
  findBallsByInningsId,
  findPlayerBattingStats,
  findPlayerBowlingStats
};
