#!/bin/bash

# Cricket Scoring API Test Script
# This script simulates a T20 match between India and South Africa

BASE_URL="http://localhost:3001/api"
MATCH_ID=""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Cricket Scoring API Test Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    # Echo debug info to stderr
    echo -e "${YELLOW}>>> $method $endpoint${NC}" >&2
    if [ -n "$data" ]; then
        echo "    Data: $data" >&2
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s "$BASE_URL$endpoint")
    else
        response=$(curl -s -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    # Still echo to stderr for visual confirmation
    echo "    Response: $response" >&2
    echo "" >&2
    
    # Echo to stdout for capturing
    echo "$response"
}

# Helper to extract ID from JSON response
extract_id() {
    python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('id', '') if isinstance(data.get('data'), dict) else '')"
}

# Wait for user confirmation between steps
wait_step() {
    echo ""
    echo -e "${GREEN}Press Enter to continue to next step...${NC}"
    read
}

# Step 1: Get all teams
echo -e "${GREEN}Step 1: Get all available teams${NC}"
echo "============================================"
api_call "GET" "/teams"
wait_step

# Step 2: Get team players
echo -e "${GREEN}Step 2: Get India team players${NC}"
echo "============================================"
api_call "GET" "/teams/team-india/players"
wait_step

echo -e "${GREEN}Step 3: Get South Africa team players${NC}"
echo "============================================"
api_call "GET" "/teams/team-sa/players"
wait_step

# Step 4: Start a new match
echo -e "${GREEN}Step 4: Start a new match - India vs South Africa${NC}"
echo "============================================================"
response=$(api_call "POST" "/match/start" '{"team1Id":"team-india","team2Id":"team-sa"}')
echo "$response"
MATCH_ID=$(echo "$response" | extract_id)
echo ""
echo -e "${YELLOW}Match ID: $MATCH_ID${NC}"
wait_step

# Step 5: Set toss result
echo -e "${GREEN}Step 5: Set toss result - India wins toss and chooses to bat${NC}"
echo "========================================================================"
api_call "POST" "/match/$MATCH_ID/toss" '{"tossWinnerId":"team-india","tossDecision":"bat"}'
wait_step

# Step 6: Initialize first innings
echo -e "${GREEN}Step 6: Initialize first innings${NC}"
echo "========================================="
echo "India batting: Rohit Sharma (striker), Virat Kohli (non-striker)"
echo "South Africa bowling: Kagiso Rabada"
api_call "POST" "/match/$MATCH_ID/innings/start" \
    '{"battingTeamId":"team-india","bowlingTeamId":"team-sa","strikerId":"ind-1","nonStrikerId":"ind-2","bowlerId":"sa-8"}'
wait_step

# Step 7: Record some balls
echo -e "${GREEN}Step 7: Record ball by ball scoring${NC}"
echo "============================================"

# Ball 1: 1 run
echo "Ball 1.1: 1 run (single)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":1}'

# Ball 2: 4 runs (boundary)
echo "Ball 1.2: 4 runs (boundary)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":4}'

# Ball 3: 0 runs (dot ball)
echo "Ball 1.3: 0 runs (dot ball)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0}'

# Ball 4: 6 runs (six)
echo "Ball 1.4: 6 runs (six)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":6}'

# Ball 5: 2 runs
echo "Ball 1.5: 2 runs"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":2}'

# Ball 6: 1 run
echo "Ball 1.6: 1 run"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":1}'

wait_step

# Step 8: Record over 2 with extras
echo -e "${GREEN}Step 8: Record over 2 with extras${NC}"
echo "====================================="

# Ball 1: Wide ball
echo "Ball 2.1: Wide (1 extra run)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0,"extraType":"wide"}'

# Ball 2: No ball
echo "Ball 2.2: No ball + 2 runs"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":2,"extraType":"no_ball"}'

# Ball 3: 4 runs
echo "Ball 2.3: 4 runs (boundary)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":4}'

# Ball 4: Leg bye
echo "Ball 2.4: Leg bye (1 run)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":1,"extraType":"leg_bye"}'

# Ball 5: 0 runs
echo "Ball 2.5: 0 runs"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0}'

# Ball 6: 1 run
echo "Ball 2.6: 1 run"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":1}'

wait_step

# Step 9: Record a wicket
echo -e "${GREEN}Step 9: Record a wicket${NC}"
echo "============================="
echo "Ball 3.1: WICKET! Bowled"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0,"isWicket":true,"wicketType":"bowled"}'
wait_step

# Step 10: Set new batsman
echo -e "${GREEN}Step 10: Set new batsman after wicket${NC}"
echo "============================================"
api_call "POST" "/match/$MATCH_ID/batsman" '{"playerId":"ind-3"}'
wait_step

# Step 11: Continue scoring
echo -e "${GREEN}Step 11: Continue scoring with new batsman${NC}"
echo "============================================"

# Ball 2: 4 runs
echo "Ball 3.2: 4 runs"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":4}'

# Ball 3: 2 runs
echo "Ball 3.3: 2 runs"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":2}'

# Ball 4: 6 runs
echo "Ball 3.4: 6 runs"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":6}'

# Ball 5: 1 run
echo "Ball 3.5: 1 run"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":1}'

# Ball 6: 0 runs
echo "Ball 3.6: 0 runs"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0}'

wait_step

# Step 12: Change bowler
echo -e "${GREEN}Step 12: Change bowler${NC}"
echo "==========================="
api_call "POST" "/match/$MATCH_ID/bowler" '{"bowlerId":"sa-9"}'
wait_step

# Step 13: Record more balls
echo -e "${GREEN}Step 13: Record over 4${NC}"
echo "========================"
for i in 1 2 3 4 5 6; do
    runs=$((RANDOM % 7))
    echo "Ball 4.$i: $runs runs"
    api_call "POST" "/match/$MATCH_ID/ball" "{\"runs\":$runs}"
done
wait_step

# Step 14: Get match summary
echo -e "${GREEN}Step 14: Get match summary${NC}"
echo "============================"
api_call "GET" "/live/$MATCH_ID/summary"
wait_step

# Step 15: Get batsman stats
echo -e "${GREEN}Step 15: Get batsman stats for innings${NC}"
echo "============================================"
# First get the innings ID from the match
INNINGS_RESPONSE=$(curl -s "$BASE_URL/match/$MATCH_ID")
INNINGS_ID=$(echo "$INNINGS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('innings', [{}])[0].get('id', ''))")
api_call "GET" "/match/$MATCH_ID/innings/$INNINGS_ID/batsmen"
wait_step

# Step 16: Get bowler stats
echo -e "${GREEN}Step 16: Get bowler stats for innings${NC}"
echo "==========================================="
api_call "GET" "/match/$MATCH_ID/innings/$INNINGS_ID/bowlers"
wait_step

# Step 17: Get ball by ball data
echo -e "${GREEN}Step 17: Get ball by ball data${NC}"
echo "====================================="
api_call "GET" "/match/$MATCH_ID/innings/$INNINGS_ID/balls"
wait_step

# Step 18: Test SSE endpoint
echo -e "${GREEN}Step 18: Test SSE endpoint (press Ctrl+C to stop)${NC}"
echo "========================================================"
echo "Connecting to SSE endpoint..."
echo "curl -N $BASE_URL/live/$MATCH_ID/events"
echo ""
echo -e "${YELLOW}Note: This will keep the connection open. Press Ctrl+C to stop.${NC}"
echo -e "${YELLOW}In a real scenario, you would see live updates here.${NC}"
wait_step

# Final summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Test Script Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Match ID: $MATCH_ID"
echo ""
echo "You can continue testing with:"
echo "  - GET /api/match/$MATCH_ID"
echo "  - GET /api/live/$MATCH_ID/summary"
echo "  - POST /api/match/$MATCH_ID/ball with various ball types"
echo ""
echo "Ball types supported:"
echo "  - runs: 0-7"
echo "  - extraType: 'wide', 'no_ball', 'bye', 'leg_bye'"
echo "  - isWicket: true/false"
echo "  - wicketType: 'bowled', 'caught', 'lbw', 'run_out', 'stumped', etc."
