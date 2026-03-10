#!/bin/bash

# Tournament API Test Script
# Tests tournament creation, team management, fixture generation, and points table

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

# 4. Get All Tournaments
echo -e "${GREEN}4. Getting All Tournaments${NC}"
api_call "GET" "/tournaments"

# 5. Add Teams to Tournament (with groups)
echo -e "${GREEN}5. Adding Teams to Tournament with Groups${NC}"
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

# 6. Get Tournament Teams
echo -e "${GREEN}6. Getting Tournament Teams${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID/teams"

# 7. Generate Fixtures
echo -e "${GREEN}7. Generating Fixtures for Tournament${NC}"
api_call "POST" "/tournaments/$TOURNAMENT_ID/fixtures/generate" '{
    "matchType": "group",
    "roundRobin": true
}'

# 8. Get Tournament Fixtures
echo -e "${GREEN}8. Getting Tournament Fixtures${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID/fixtures"

# 9. Get Points Table (Group A)
echo -e "${GREEN}9. Getting Points Table (Group A)${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID/points?group=Group A"

# 10. Get Points Table (Group B)
echo -e "${GREEN}10. Getting Points Table (Group B)${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID/points?group=Group B"

# 11. Get Full Tournament Details
echo -e "${GREEN}11. Getting Full Tournament Details${NC}"
api_call "GET" "/tournaments/$TOURNAMENT_ID"

# 12. Create Asia Cup Tournament
echo -e "${GREEN}12. Creating Asia Cup 2024${NC}"
response=$(api_call "POST" "/tournaments" '{
    "name": "Asia Cup 2024",
    "shortName": "AC2024",
    "type": "asia_cup",
    "startDate": "2024-09-01",
    "endDate": "2024-09-17",
    "hostCountry": "Sri Lanka"
}')
ASIA_CUP_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# 13. Add Asian Teams
echo -e "${GREEN}13. Adding Asian Teams to Asia Cup${NC}"
api_call "POST" "/tournaments/$ASIA_CUP_ID/teams" '{
    "teamIds": ["team-india", "team-pak", "team-sl", "team-ban", "team-afg", "team-nep"]
}'

# 14. Generate Asia Cup Fixtures
echo -e "${GREEN}14. Generating Asia Cup Fixtures${NC}"
api_call "POST" "/tournaments/$ASIA_CUP_ID/fixtures/generate" '{
    "matchType": "group"
}'

# 15. Verify 1-day gap constraint
echo -e "${GREEN}15. Verifying 1-Day Gap Constraint${NC}"
echo "Checking fixtures for India in World Cup..."
api_call "GET" "/tournaments/$TOURNAMENT_ID/fixtures" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    fixtures = data.get('data', [])
    india_fixtures = [f for f in fixtures if 'team-india' in [f.get('team1_id'), f.get('team2_id')]]
    print(f'India has {len(india_fixtures)} matches:')
    for f in sorted(india_fixtures, key=lambda x: x.get('match_date', '')):
        print(f\"  {f.get('match_date')}: vs {f.get('team1_name') if f.get('team2_id') == 'team-india' else f.get('team2_name')}\")
    
    # Check gaps
    dates = sorted([f.get('match_date') for f in india_fixtures])
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

# 16. Test creating fixture with violation (should fail)
echo -e "${GREEN}16. Testing 1-Day Gap Violation (should fail)${NC}"
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

# 17. Create a valid fixture manually
echo -e "${GREEN}17. Creating Valid Fixture Manually${NC}"
api_call "POST" "/tournaments/fixtures" "{
    \"tournamentId\": \"$TOURNAMENT_ID\",
    \"team1Id\": \"team-india\",
    \"team2Id\": \"team-eng\",
    \"matchDate\": \"2024-07-01\",
    \"matchType\": \"final\",
    \"stadiumId\": \"$STADIUM_ID_1\"
}"

# 18. Get All Tournaments Summary
echo -e "${GREEN}18. Final Summary - All Tournaments${NC}"
api_call "GET" "/tournaments"

# 19. Delete Asia Cup
echo -e "${GREEN}19. Deleting Asia Cup Tournament${NC}"
api_call "DELETE" "/tournaments/$ASIA_CUP_ID"

# 20. Verify Deletion
echo -e "${GREEN}20. Verifying Asia Cup Deletion${NC}"
api_call "GET" "/tournaments"

echo -e "${GREEN}Tournament Tests Completed!${NC}"
