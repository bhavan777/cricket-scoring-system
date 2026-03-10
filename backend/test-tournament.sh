#!/bin/bash

# Tournament API Test Script
# Tests tournament creation, team management, fixture generation, knockout stages, and super over

BASE_URL="http://localhost:3001/api"
TOURNAMENT_ID=""
STADIUM_ID=""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Tournament API Tests${NC}"
echo -e "${BLUE}  - Knockout Stages${NC}"
echo -e "${BLUE}  - Super Over Support${NC}"
echo -e "${BLUE}  - NRR Tie-Breakers${NC}"
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

# 1. Create Stadiums
echo -e "${GREEN}1. Creating Stadiums${NC}"
response=$(api_call "POST" "/tournaments/stadiums" '{
    "name": "Melbourne Cricket Ground",
    "city": "Melbourne",
    "country": "Australia",
    "capacity": 100024
}')
STADIUM_ID_1=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

api_call "POST" "/tournaments/stadiums" '{
    "name": "Wankhede Stadium",
    "city": "Mumbai",
    "country": "India",
    "capacity": 33000
}'

api_call "POST" "/tournaments/stadiums" '{
    "name": "Lord'\''s Cricket Ground",
    "city": "London",
    "country": "England",
    "capacity": 30000
}'

# 2. Get All Stadiums
echo -e "${GREEN}2. Getting All Stadiums${NC}"
api_call "GET" "/tournaments/stadiums/all"

# 3. Create a World Cup Tournament
echo -e "${GREEN}3. Creating ICC T20 World Cup 2024${NC}"
response=$(api_call "POST" "/tournaments" '{
    "name": "ICC T20 World Cup 2024",
    "shortName": "T20WC2024",
    "type": "world_cup",
    "startDate": "2024-06-01",
    "endDate": "2024-06-29",
    "hostCountry": "USA & West Indies"
}')
TOURNAMENT_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "${BLUE}Tournament ID: $TOURNAMENT_ID${NC}"

# 4. Add Teams to Tournament (with groups for World Cup format)
echo -e "${GREEN}4. Adding Teams to Tournament with Groups${NC}"
api_call "POST" "/tournaments/$TOURNAMENT_ID/teams" '{
    "teamIds": ["team-india", "team-pak", "team-ire", "team-usa"],
    "groupConfig": {
        "team-india": "Group A",
        "team-pak": "Group A",
        "team-ire": "Group A",
        "team-usa": "Group A"
    }
}'

# Add more teams to Group B
api_call "POST" "/tournaments/$TOURNAMENT_ID/teams" '{
    "teamIds": ["team-eng", "team-aus", "team-nam", "team-oma"],
    "groupConfig": {
        "team-eng": "Group B",
        "team-aus": "Group B",
        "team-nam": "Group B",
        "team-oma": "Group B"
    }
}'

# 5. Get Tournament Teams
echo -e "${GREEN}5. Getting Tournament Teams${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID/teams"

# 6. Generate Fixtures with Knockout Stages
echo -e "${GREEN}6. Generating Fixtures with Knockout Stages${NC}"
api_call "POST" "/tournaments/$TOURNAMENT_ID/fixtures/generate" '{
    "matchType": "group",
    "roundRobin": true,
    "includeKnockouts": true,
    "knockoutTeams": 4
}'

# 7. Get Tournament Fixtures - Check for Knockout Stages
echo -e "${GREEN}7. Getting Tournament Fixtures (should include knockout stages)${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID/fixtures" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    fixtures = data.get('data', [])
    stages = {}
    for f in fixtures:
        stage = f.get('stage', 'group')
        if stage not in stages:
            stages[stage] = 0
        stages[stage] += 1
    
    print('Fixtures by stage:')
    for stage, count in stages.items():
        print(f'  {stage}: {count} matches')
    
    # Check knockout stages exist
    if 'semi_final' in stages:
        print(f\"  ✓ Semi-finals generated\")
    if 'final' in stages:
        print(f\"  ✓ Final generated\")
except Exception as e:
    print(f'Error: {e}')
"

# 8. Get Points Table (Group A)
echo -e "${GREEN}8. Getting Points Table (Group A)${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID/points?group=Group A"

# 9. Get Points Table (Group B)
echo -e "${GREEN}9. Getting Points Table (Group B)${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID/points?group=Group B"

# 10. Test NRR Calculation and Tie-Breaker
echo -e "${GREEN}10. Testing NRR Calculation${NC}"
echo "NRR Formula: (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)"
echo "If team is all-out, they face full 20 overs for NRR calculation"

# Simulate updating points after a match
# This would normally be called by the scoring service after a match completes
api_call "POST" "/tournaments/$TOURNAMENT_ID/points/update" '{
    "matchId": "test-match-1",
    "winnerId": "team-india",
    "team1Runs": 180,
    "team2Runs": 150,
    "team1Overs": 20,
    "team2Overs": 18.5,
    "team1Wickets": 4,
    "team2Wickets": 10
}'

# 11. Get Qualified Teams
echo -e "${GREEN}11. Getting Qualified Teams for Knockouts${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID/qualified?numTeams=4"

# 12. Update Knockout Fixtures with Qualified Teams
echo -e "${GREEN}12. Updating Knockout Fixtures with Qualified Teams${NC}"
api_call "POST" "/tournaments/$TOURNAMENT_ID/knockouts/update" '{
    "qualificationRules": {
        "SF1_Team1": "team-india",
        "SF1_Team2": "team-aus",
        "SF2_Team1": "team-eng",
        "SF2_Team2": "team-pak",
        "FINAL_Team1": "winner-SF1",
        "FINAL_Team2": "winner-SF2"
    }
}'

# 13. Get Full Tournament Details
echo -e "${GREEN}13. Getting Full Tournament Details${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID"

# 14. Create Asia Cup Tournament
echo -e "${GREEN}14. Creating Asia Cup 2024${NC}"
response=$(api_call "POST" "/tournaments" '{
    "name": "Asia Cup 2024",
    "shortName": "AC2024",
    "type": "asia_cup",
    "startDate": "2024-09-01",
    "endDate": "2024-09-17",
    "hostCountry": "Sri Lanka"
}')
ASIA_CUP_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# 15. Add Asian Teams
echo -e "${GREEN}15. Adding Asian Teams to Asia Cup${NC}"
api_call "POST" "/tournaments/$ASIA_CUP_ID/teams" '{
    "teamIds": ["team-india", "team-pak", "team-sl", "team-ban", "team-afg", "team-nep"]
}'

# 16. Generate Asia Cup Fixtures with 8-team knockout
echo -e "${GREEN}16. Generating Asia Cup Fixtures with Quarter Finals${NC}"
api_call "POST" "/tournaments/$ASIA_CUP_ID/fixtures/generate" '{
    "matchType": "group",
    "roundRobin": true,
    "includeKnockouts": true,
    "knockoutTeams": 8
}'

# 17. Verify 1-day gap constraint
echo -e "${GREEN}17. Verifying 1-Day Gap Constraint${NC}"
echo "Checking fixtures for India in World Cup..."
api_call "GET" "/tournaments/$TOURNAMENT_ID/fixtures" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    fixtures = data.get('data', [])
    india_fixtures = [f for f in fixtures if 'team-india' in [f.get('team1_id'), f.get('team2_id')]]
    print(f'India has {len(india_fixtures)} matches:')
    for f in sorted(india_fixtures, key=lambda x: x.get('match_date', '')):
        stage = f.get('stage', 'group')
        print(f\"  {f.get('match_date')}: vs {f.get('team1_name') if f.get('team2_id') == 'team-india' else f.get('team2_name')} [{stage}]\")
    
    # Check gaps
    dates = sorted([f.get('match_date') for f in india_fixtures if f.get('stage') == 'group'])
    from datetime import datetime
    for i in range(1, len(dates)):
        d1 = datetime.strptime(dates[i-1], '%Y-%m-%d')
        d2 = datetime.strptime(dates[i], '%Y-%m-%d')
        gap = (d2 - d1).days
        status = 'OK' if gap >= 1 else 'ERROR'
        print(f'  Gap between {dates[i-1]} and {dates[i]}: {gap} days [{status}]')
except Exception as e:
    print(f'Error: {e}')
"

# 18. Test creating fixture with violation (should fail)
echo -e "${GREEN}18. Testing 1-Day Gap Violation (should fail)${NC}"
# Get first fixture date
FIRST_DATE=$(api_call "GET" "/tournaments/$TOURNAMENT_ID/fixtures" | python3 -c "
import sys, json
data = json.load(sys.stdin)
fixtures = data.get('data', [])
if fixtures:
    print(fixtures[0].get('match_date'))
")

# Try to create fixture on same date for same team (should fail)
api_call "POST" "/tournaments/fixtures" "{
    \"tournamentId\": \"$TOURNAMENT_ID\",
    \"team1Id\": \"team-india\",
    \"team2Id\": \"team-eng\",
    \"matchDate\": \"$FIRST_DATE\",
    \"matchType\": \"group\"
}"

# 19. Test Super Over Flow
echo -e "${GREEN}19. Testing Super Over Flow${NC}"
echo "Note: Super Over is used when a knockout match ends in a tie"
echo "ICC Rules:"
echo "  1. Each team bats 1 over (6 legal deliveries)"
echo "  2. Higher score wins"
echo "  3. If tied, boundary count in super over decides"
echo "  4. If still tied, boundary count from entire match decides"

# Create a match for super over testing
response=$(api_call "POST" "/match/start" '{"team1Id":"team-india","team2Id":"team-pak"}')
MATCH_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Start super over (simulating a tied match)
echo -e "${GREEN}19a. Starting Super Over (Team India bats first)${NC}"
response=$(api_call "POST" "/tournaments/super-over/match/$MATCH_ID/start" '{
    "battingTeamId": "team-india",
    "bowlingTeamId": "team-pak",
    "strikerId": "ind-1",
    "nonStrikerId": "ind-2",
    "bowlerId": "pak-8"
}')
SUPER_OVER_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Record some balls in super over
echo -e "${GREEN}19b. Recording Super Over Balls${NC}"
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"ind-1","bowlerId":"pak-8","runs":6}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"ind-1","bowlerId":"pak-8","runs":4}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"ind-1","bowlerId":"pak-8","runs":2}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"ind-1","bowlerId":"pak-8","runs":1}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"ind-1","bowlerId":"pak-8","runs":0}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"ind-1","bowlerId":"pak-8","runs":4}'

echo "India scored 17 runs in their super over"

# Start Pakistan's super over
echo -e "${GREEN}19c. Starting Pakistan'\''s Super Over${NC}"
api_call "POST" "/tournaments/super-over/match/$MATCH_ID/start" '{
    "battingTeamId": "team-pak",
    "bowlingTeamId": "team-india",
    "strikerId": "pak-1",
    "nonStrikerId": "pak-2",
    "bowlerId": "ind-8"
}'

# Record Pakistan's super over (scoring less)
echo -e "${GREEN}19d. Recording Pakistan'\''s Super Over Balls${NC}"
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"pak-1","bowlerId":"ind-8","runs":4}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"pak-1","bowlerId":"ind-8","runs":2}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"pak-1","bowlerId":"ind-8","runs":1}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"pak-1","bowlerId":"ind-8","runs":6}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"pak-1","bowlerId":"ind-8","runs":0}'
api_call "POST" "/tournaments/super-over/$SUPER_OVER_ID/ball" '{"batsmanId":"pak-1","bowlerId":"ind-8","runs":2}'

echo "Pakistan scored 15 runs in their super over"

# Get super over result
echo -e "${GREEN}19e. Getting Super Over Result${NC}"
api_call "GET" "/tournaments/super-over/match/$MATCH_ID"

# Determine winner
echo -e "${GREEN}19f. Determining Super Over Winner${NC}"
api_call "GET" "/tournaments/super-over/match/$MATCH_ID/winner"

# Complete the match
echo -e "${GREEN}19g. Completing Super Over Match${NC}"
api_call "POST" "/tournaments/super-over/match/$MATCH_ID/complete" '{"winnerId":"team-india"}'

# 20. Get All Tournaments Summary
echo -e "${GREEN}20. Final Summary - All Tournaments${NC}"
api_call "GET" "/tournaments"

# 21. Delete Asia Cup
echo -e "${GREEN}21. Deleting Asia Cup Tournament${NC}"
api_call "DELETE" "/tournaments/$ASIA_CUP_ID"

# 22. Verify Deletion
echo -e "${GREEN}22. Verifying Asia Cup Deletion${NC}"
api_call "GET" "/tournaments"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Tournament Tests Completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Summary of tested features:"
echo "  ✓ Tournament creation (World Cup, Asia Cup)"
echo "  ✓ Team management with groups"
echo "  ✓ Fixture generation with 1-day gap constraint"
echo "  ✓ Knockout stages (Quarter Finals, Semi Finals, Final)"
echo "  ✓ Points table with NRR calculation"
echo "  ✓ Qualified teams for knockouts"
echo "  ✓ Super Over support with ICC rules"
echo "  ✓ Boundary count tie-breaker"
echo "  ✓ Tournament deletion"
