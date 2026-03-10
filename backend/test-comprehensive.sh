#!/bin/bash

# Comprehensive Cricket Scoring API Test Script
# This script covers all major cricket rules, extras, and dismissal types

BASE_URL="http://localhost:3001/api"
MATCH_ID=""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Comprehensive Cricket API Tests${NC}"
echo -e "${BLUE}========================================${NC}"

# Helper function
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    echo -e "${YELLOW}>>> $method $endpoint${NC}"
    if [ "$method" = "GET" ]; then
        response=$(curl -s "$BASE_URL$endpoint")
    else
        response=$(curl -s -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    echo "$response"
}

# 1. Setup Match
echo -e "${GREEN}1. Setting up Match (England vs New Zealand)${NC}"
response=$(api_call "POST" "/match/start" '{"team1Id":"team-eng","team2Id":"team-nz"}')
MATCH_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
api_call "POST" "/match/$MATCH_ID/toss" '{"tossWinnerId":"team-eng","tossDecision":"bat"}'
api_call "POST" "/match/$MATCH_ID/innings/start" \
    '{"battingTeamId":"team-eng","bowlingTeamId":"team-nz","strikerId":"eng-1","nonStrikerId":"eng-2","bowlerId":"nz-8"}'
echo -e "${BLUE}Match ID: $MATCH_ID${NC}"

# 2. Test All Extra Types
echo -e "${GREEN}2. Testing Extras (Wide, No Ball, Bye, Leg Bye)${NC}"

# Wide (1 run extra, ball doesn't count)
echo "Ball 1.1: Wide (1 extra run)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0,"extraType":"wide"}'

# No Ball + 4 runs (5 runs total, ball doesn't count)
echo "Ball 1.1: No Ball + 4 runs (5 total)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":4,"extraType":"no_ball"}'

# Bye (4 runs, ball counts)
echo "Ball 1.1: 4 Byes"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":4,"extraType":"bye"}'

# Leg Bye (1 run, ball counts)
echo "Ball 1.2: 1 Leg Bye"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":1,"extraType":"leg_bye"}'

# 3. Test Various Dismissal Types
echo -e "${GREEN}3. Testing Various Dismissal Types${NC}"

# Caught
echo "Ball 1.3: WICKET! Caught"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0,"isWicket":true,"wicketType":"caught","fielderId":"nz-1"}'
api_call "POST" "/match/$MATCH_ID/batsman" '{"playerId":"eng-3"}'

# LBW
echo "Ball 1.4: WICKET! LBW"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0,"isWicket":true,"wicketType":"lbw"}'
api_call "POST" "/match/$MATCH_ID/batsman" '{"playerId":"eng-4"}'

# Run Out
echo "Ball 1.5: WICKET! Run Out"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":1,"isWicket":true,"wicketType":"run_out","dismissedPlayerId":"eng-2"}'
api_call "POST" "/match/$MATCH_ID/batsman" '{"playerId":"eng-5"}'

# Stumped
echo "Ball 1.6: WICKET! Stumped"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0,"isWicket":true,"wicketType":"stumped","fielderId":"nz-1"}'
api_call "POST" "/match/$MATCH_ID/batsman" '{"playerId":"eng-6"}'

# 4. Finish 1st Innings Quickly (Simulate 10 wickets)
echo -e "${GREEN}4. Simulating Innings End via 10 Wickets${NC}"
# We already have 4 wickets. Let's add 6 more.
for i in 7 8 9 10 11; do
    api_call "POST" "/match/$MATCH_ID/ball" '{"runs":0,"isWicket":true,"wicketType":"bowled"}'
    if [ $i -lt 11 ]; then
        api_call "POST" "/match/$MATCH_ID/batsman" "{\"playerId\":\"eng-$i\"}"
    fi
done

# 5. Start 2nd Innings
echo -e "${GREEN}5. Starting 2nd Innings (New Zealand Chase)${NC}"
# Check if match is in 2nd innings automatically (from our logic)
api_call "POST" "/match/$MATCH_ID/innings/start" \
    '{"battingTeamId":"team-nz","bowlingTeamId":"team-eng","strikerId":"nz-1","nonStrikerId":"nz-2","bowlerId":"eng-8"}'

# 6. Test Strike Rotation
echo -e "${GREEN}6. Testing Strike Rotation${NC}"
# Ball 1: 1 run (Swaps strike)
echo "Ball 1.1: 1 run (Swap strike)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":1}'

# Ball 2: 3 runs (Swaps strike)
echo "Ball 1.2: 3 runs (Swap strike)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":3}'

# Ball 3: 2 runs (No swap)
echo "Ball 1.3: 2 runs (No swap)"
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":2}'

# 7. Complete Match
echo -e "${GREEN}7. Completing Match via Runs Chased${NC}"
# England score was low (~15 runs). Let's score 20 runs for NZ.
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":6}'
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":6}'
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":6}'
api_call "POST" "/match/$MATCH_ID/ball" '{"runs":4}'

# 8. Verify Results
echo -e "${GREEN}8. Verifying Final Match Summary${NC}"
api_call "GET" "/live/$MATCH_ID/summary"

echo -e "${GREEN}Tests Completed!${NC}"
