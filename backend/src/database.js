const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use a known writable relative path
const dbPath = path.join(process.cwd(), 'data', 'cricket.db');
const teamsDataPath = path.join(__dirname, '..', 'data', 'teams.json');

// Ensure data directory exists and is writable
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
try {
  fs.chmodSync(dataDir, 0o777);
} catch (e) {
  console.warn('Could not chmod data directory, continuing...', e.message);
}

let db;
try {
  // Initialize database with explicit options to avoid readonly issues
  db = new Database(dbPath, { 
    verbose: console.log,
    fileMustExist: false,
    timeout: 5000 // Add timeout for busy databases
  });

  // Enable foreign keys and set journaling to DELETE mode (most compatible)
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = DELETE');
  db.pragma('synchronous = NORMAL');
  
  // Test write access immediately
  db.exec('CREATE TABLE IF NOT EXISTS _write_test (id INTEGER PRIMARY KEY)');
  db.exec('INSERT INTO _write_test DEFAULT VALUES');
  db.exec('DROP TABLE _write_test');
  
  console.log('Database initialized successfully at:', dbPath);
} catch (error) {
  console.error('CRITICAL: Database initialization failed:', error.message);
  // If it fails, try in-memory as a fallback so the app at least starts
  console.log('Falling back to in-memory database...');
  db = new Database(':memory:', { verbose: console.log });
  db.pragma('foreign_keys = ON');
}

// Create tables
const initDatabase = () => {
  try {
    // Teams table
    db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Players table
    db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        batting_style TEXT,
        bowling_style TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )
    `);

    // Matches table
    db.exec(`
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        team1_id TEXT NOT NULL,
        team2_id TEXT NOT NULL,
        toss_winner_id TEXT,
        toss_decision TEXT,
        current_innings INTEGER DEFAULT 1,
        status TEXT DEFAULT 'not_started',
        winner_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (team1_id) REFERENCES teams(id),
        FOREIGN KEY (team2_id) REFERENCES teams(id),
        FOREIGN KEY (toss_winner_id) REFERENCES teams(id),
        FOREIGN KEY (winner_id) REFERENCES teams(id)
      )
    `);

    // Innings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS innings (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        innings_number INTEGER NOT NULL,
        batting_team_id TEXT NOT NULL,
        bowling_team_id TEXT NOT NULL,
        total_runs INTEGER DEFAULT 0,
        total_wickets INTEGER DEFAULT 0,
        total_overs TEXT DEFAULT '0.0',
        extras INTEGER DEFAULT 0,
        is_complete INTEGER DEFAULT 0,
        FOREIGN KEY (match_id) REFERENCES matches(id),
        FOREIGN KEY (batting_team_id) REFERENCES teams(id),
        FOREIGN KEY (bowling_team_id) REFERENCES teams(id)
      )
    `);

    // Ball by ball records
    db.exec(`
      CREATE TABLE IF NOT EXISTS balls (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        innings_id TEXT NOT NULL,
        over_number INTEGER NOT NULL,
        ball_number INTEGER NOT NULL,
        batsman_id TEXT NOT NULL,
        non_striker_id TEXT NOT NULL,
        bowler_id TEXT NOT NULL,
        runs_scored INTEGER DEFAULT 0,
        extras INTEGER DEFAULT 0,
        extra_type TEXT,
        is_wicket INTEGER DEFAULT 0,
        wicket_type TEXT,
        dismissed_player_id TEXT,
        is_boundary INTEGER DEFAULT 0,
        boundary_type TEXT,
        commentary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES matches(id),
        FOREIGN KEY (innings_id) REFERENCES innings(id),
        FOREIGN KEY (batsman_id) REFERENCES players(id),
        FOREIGN KEY (non_striker_id) REFERENCES players(id),
        FOREIGN KEY (bowler_id) REFERENCES players(id),
        FOREIGN KEY (dismissed_player_id) REFERENCES players(id)
      )
    `);

    // Batsman innings stats
    db.exec(`
      CREATE TABLE IF NOT EXISTS batsman_innings (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        innings_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        runs INTEGER DEFAULT 0,
        balls_faced INTEGER DEFAULT 0,
        fours INTEGER DEFAULT 0,
        sixes INTEGER DEFAULT 0,
        is_out INTEGER DEFAULT 0,
        dismissal_type TEXT,
        dismissed_by TEXT,
        fielder_id TEXT,
        batting_position INTEGER,
        is_on_strike INTEGER DEFAULT 0,
        FOREIGN KEY (match_id) REFERENCES matches(id),
        FOREIGN KEY (innings_id) REFERENCES innings(id),
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (fielder_id) REFERENCES players(id)
      )
    `);

    // Bowler innings stats
    db.exec(`
      CREATE TABLE IF NOT EXISTS bowler_innings (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        innings_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        overs TEXT DEFAULT '0.0',
        balls INTEGER DEFAULT 0,
        maidens INTEGER DEFAULT 0,
        runs_conceded INTEGER DEFAULT 0,
        wickets INTEGER DEFAULT 0,
        wides INTEGER DEFAULT 0,
        no_balls INTEGER DEFAULT 0,
        FOREIGN KEY (match_id) REFERENCES matches(id),
        FOREIGN KEY (innings_id) REFERENCES innings(id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      )
    `);

    // Fall of wickets
    db.exec(`
      CREATE TABLE IF NOT EXISTS fall_of_wickets (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        innings_id TEXT NOT NULL,
        wicket_number INTEGER NOT NULL,
        runs_at_dismissal INTEGER NOT NULL,
        overs_at_dismissal TEXT NOT NULL,
        dismissed_player_id TEXT NOT NULL,
        FOREIGN KEY (match_id) REFERENCES matches(id),
        FOREIGN KEY (innings_id) REFERENCES innings(id),
        FOREIGN KEY (dismissed_player_id) REFERENCES players(id)
      )
    `);

    // Match state (current state tracking)
    db.exec(`
      CREATE TABLE IF NOT EXISTS match_state (
        match_id TEXT PRIMARY KEY,
        current_innings INTEGER DEFAULT 1,
        current_over INTEGER DEFAULT 0,
        current_ball INTEGER DEFAULT 0,
        striker_id TEXT,
        non_striker_id TEXT,
        current_bowler_id TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES matches(id)
      )
    `);

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error initializing database tables:', error.message);
    throw error;
  }
};

// Seed initial data
const seedData = () => {
  try {
    const existingTeams = db.prepare('SELECT COUNT(*) as count FROM teams').get();
    if (existingTeams.count > 0) {
      console.log('Teams already seeded, skipping...');
      return;
    }

    const teamsData = JSON.parse(fs.readFileSync(teamsDataPath, 'utf8'));
    const insertTeam = db.prepare('INSERT INTO teams (id, name, short_name) VALUES (?, ?, ?)');
    const insertPlayer = db.prepare('INSERT INTO players (id, team_id, name, role, batting_style, bowling_style) VALUES (?, ?, ?, ?, ?, ?)');

    const insertMany = db.transaction((teams) => {
      for (const team of teams) {
        insertTeam.run(team.id, team.name, team.shortName);
        for (const player of team.players) {
          insertPlayer.run(player.id, team.id, player.name, player.role, player.battingStyle, player.bowlingStyle);
        }
      }
    });

    insertMany(teamsData.teams);
    console.log('Seeded teams and players successfully');
  } catch (error) {
    console.error('Error seeding data:', error.message);
    // Don't throw here, as we want the app to start even if seeding fails
  }
};

module.exports = {
  db,
  initDatabase,
  seedData
};
