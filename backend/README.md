# Cricket Scoring Backend

A Node.js + Express backend for a T20 Cricket Scoring System designed for official scorers.

## Features

- **Team Management**: Pre-loaded with 4 national teams (India, South Africa, England, New Zealand) with full player squads
- **Match Management**: Start matches, set toss results, manage innings
- **Ball-by-Ball Scoring**: Record every ball with support for:
  - Runs (0-6)
  - Boundaries (4s and 6s)
  - Extras (Wide, No Ball, Bye, Leg Bye)
  - Wickets (Bowled, Caught, LBW, Run Out, Stumped, etc.)
- **Live Updates**: Server-Sent Events (SSE) endpoint for real-time match updates
- **Statistics**: Batsman and bowler stats, fall of wickets, ball-by-ball data

## Installation

```bash
cd backend
npm install
```

## Running the Server

```bash
npm start
```

The server will start on port 3001 by default.

## API Endpoints

### Teams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | Get all teams |
| GET | `/api/teams/:id` | Get team by ID |
| GET | `/api/teams/:id/players` | Get players for a team |

### Match

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/match/start` | Start a new match |
| POST | `/api/match/:matchId/toss` | Set toss result |
| POST | `/api/match/:matchId/innings/start` | Initialize innings |
| POST | `/api/match/:matchId/ball` | Record a ball |
| POST | `/api/match/:matchId/batsman` | Set new batsman |
| POST | `/api/match/:matchId/bowler` | Set new bowler |
| GET | `/api/match/:matchId` | Get match details |
| GET | `/api/match` | Get all matches |

### Live Updates (SSE)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/live/:matchId/events` | SSE endpoint for live updates |
| GET | `/api/live/:matchId/summary` | Get match summary for UI |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/match/:matchId/innings/:inningsId/batsmen` | Get batsman stats |
| GET | `/api/match/:matchId/innings/:inningsId/bowlers` | Get bowler stats |
| GET | `/api/match/:matchId/innings/:inningsId/wickets` | Get fall of wickets |
| GET | `/api/match/:matchId/innings/:inningsId/balls` | Get ball by ball data |

## Ball Recording Format

```json
{
  "runs": 4,              // Runs scored (0-7)
  "extraType": null,     // "wide", "no_ball", "bye", "leg_bye", or null
  "isWicket": false,     // true if wicket fell
  "wicketType": null,    // "bowled", "caught", "lbw", "run_out", "stumped", etc.
  "dismissedPlayerId": null,  // Player who got out (for caught/run_out)
  "fielderId": null      // Fielder involved (for caught/run_out)
}
```

## Match Workflow

1. **Start Match**: `POST /api/match/start` with `team1Id` and `team2Id`
2. **Set Toss**: `POST /api/match/:matchId/toss` with `tossWinnerId` and `tossDecision`
3. **Start Innings**: `POST /api/match/:matchId/innings/start` with batting/bowling teams and initial players
4. **Record Balls**: `POST /api/match/:matchId/ball` for each ball
5. **Handle Wickets**: `POST /api/match/:matchId/batsman` to set new batsman after wicket
6. **Change Bowlers**: `POST /api/match/:matchId/bowler` to change bowler

## Test Script

Run the test script to simulate a match:

```bash
./test-match.sh
```

## Pre-loaded Teams

1. **India (team-india)**: Rohit Sharma, Virat Kohli, Suryakumar Yadav, KL Rahul, Hardik Pandya, Ravindra Jadeja, Rishabh Pant, Jasprit Bumrah, Mohammed Shami, Yuzvendra Chahal, Bhuvneshwar Kumar

2. **South Africa (team-sa)**: Quinton de Kock, Reeza Hendricks, Aiden Markram, Heinrich Klaasen, David Miller, Tristan Stubbs, Marco Jansen, Kagiso Rabada, Anrich Nortje, Keshav Maharaj, Tabraiz Shamsi

3. **England (team-eng)**: Jos Buttler, Phil Salt, Joe Root, Harry Brook, Ben Stokes, Liam Livingstone, Moeen Ali, Jofra Archer, Mark Wood, Adil Rashid, Chris Woakes

4. **New Zealand (team-nz)**: Devon Conway, Finn Allen, Kane Williamson, Daryl Mitchell, Glenn Phillips, Mark Chapman, Mitchell Santner, Tim Southee, Trent Boult, Lockie Ferguson, Ish Sodhi

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Real-time**: Server-Sent Events (SSE)
- **ID Generation**: UUID

## Cricket Rules Implemented

- T20 format (20 overs per innings)
- Maximum 4 overs per bowler
- All standard extras: Wide, No Ball, Bye, Leg Bye
- All dismissal types: Bowled, Caught, LBW, Run Out, Stumped, Hit Wicket
- Strike rotation on odd runs and end of over
- Innings completion on 10 wickets or 20 overs
