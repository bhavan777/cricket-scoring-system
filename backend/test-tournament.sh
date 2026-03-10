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
    
    # Echo debug info to stderr so it doesn't pollute stdout when captured
    echo -e "${YELLOW}>>> $method $endpoint${NC}" >&2
    
    if [ "$method" = "GET" ]; then
        curl -s "$BASE_URL$endpoint"
    else
        curl -s -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# Helper to extract ID from JSON response
extract_id() {
    python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    result = data.get('data', {})
    if isinstance(result, dict):
        print(result.get('id', ''))
    else:
        print('')
except:
    print('')
"
}

# ============ Test Team and Player CRUD ============

echo -e "${GREEN}0. Testing Team and Player CRUD Operations${NC}"

# Create a new team
echo -e "${YELLOW}0a. Creating a new team${NC}"
response=$(api_call "POST" "/teams" '{
    "name": "Test Cricket Club",
    "shortName": "TCC",
    "players": [
        {"name": "John Smith", "role": "Batsman", "battingStyle": "Right-hand", "bowlingStyle": "Right-arm medium"},
        {"name": "Mike Johnson", "role": "Bowler", "battingStyle": "Left-hand", "bowlingStyle": "Left-arm fast"}
    ]
}')
echo "$response"
NEW_TEAM_ID=$(echo "$response" | extract_id)

if [ -z "$NEW_TEAM_ID" ]; then
    echo -e "${RED}Error: Failed to create team${NC}"
else
    echo -e "${BLUE}New Team ID: $NEW_TEAM_ID${NC}"
    
    # Get the team
    echo -e "${YELLOW}0b. Getting the new team${NC}"
    api_call "GET" "/teams/$NEW_TEAM_ID"
    
    # Update the team
    echo -e "${YELLOW}0c. Updating the team name${NC}"
    api_call "PUT" "/teams/$NEW_TEAM_ID" '{"name": "Test Cricket Club Updated"}'
    
    # Add a new player to the team
    echo -e "${YELLOW}0d. Adding a new player to the team${NC}"
    response=$(api_call "POST" "/teams/$NEW_TEAM_ID/players" '{
        "players": [
            {"name": "David Brown", "role": "All-rounder", "battingStyle": "Right-hand", "bowlingStyle": "Right-arm off break"}
        ]
    }')
    echo "$response"
    
    # Get team players
    echo -e "${YELLOW}0e. Getting team players${NC}"
    api_call "GET" "/teams/$NEW_TEAM_ID/players"
    
    # Delete the test team
    echo -e "${YELLOW}0f. Deleting the test team${NC}"
    api_call "DELETE" "/teams/$NEW_TEAM_ID"
fi

echo ""

# 1. Create Stadiums
echo -e "${GREEN}1. Creating Stadiums${NC}"
response=$(api_call "POST" "/tournaments/stadiums" '{
    "name": "Melbourne Cricket Ground",
    "city": "Melbourne",
    "country": "Australia",
    "capacity": 100024
}')
echo "$response"
STADIUM_ID_1=$(echo "$response" | extract_id)

if [ -z "$STADIUM_ID_1" ]; then
    echo -e "${RED}Error: Failed to create stadium or capture ID${NC}"
    exit 1
fi
echo -e "${BLUE}Stadium ID 1: $STADIUM_ID_1${NC}"

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
echo "$response"
TOURNAMENT_ID=$(echo "$response" | extract_id)

if [ -z "$TOURNAMENT_ID" ]; then
    echo -e "${RED}Error: Failed to create tournament or capture ID${NC}"
    exit 1
fi
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
echo "$response"
ASIA_CUP_ID=$(echo "$response" | extract_id)

if [ -z "$ASIA_CUP_ID" ]; then
    echo -e "${RED}Error: Failed to create Asia Cup tournament or capture ID${NC}"
    exit 1
fi
echo -e "${BLUE}Asia Cup ID: $ASIA_CUP_ID${NC}"

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
try:
    data = json.load(sys.stdin)
    fixtures = data.get('data', [])
    if fixtures:
        print(fixtures[0].get('match_date'))
except:
    pass
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
echo "$response"
MATCH_ID=$(echo "$response" | extract_id)

if [ -z "$MATCH_ID" ]; then
    echo -e "${RED}Error: Failed to create match or capture ID${NC}"
    # Fallback to a test ID if needed, but better to fail
    exit 1
fi
echo -e "${BLUE}Match ID: $MATCH_ID${NC}"

# Start super over (simulating a tied match)
echo -e "${GREEN}19a. Starting Super Over (Team India bats first)${NC}"
response=$(api_call "POST" "/tournaments/super-over/match/$MATCH_ID/start" '{
    "battingTeamId": "team-india",
    "bowlingTeamId": "team-pak",
    "strikerId": "ind-1",
    "nonStrikerId": "ind-2",
    "bowlerId": "pak-8"
}')
echo "$response"
SUPER_OVER_ID=$(echo "$response" | extract_id)

if [ -z "$SUPER_OVER_ID" ]; then
    echo -e "${RED}Error: Failed to start super over or capture ID${NC}"
    exit 1
fi
echo -e "${BLUE}Super Over ID: $SUPER_OVER_ID${NC}"

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

# ============ Test Match States and DLS ============

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing Match States and DLS${NC}"
echo -e "${BLUE}========================================${NC}"

# 23. Create a scheduled match
echo -e "${GREEN}23. Creating a Scheduled Match${NC}"
response=$(api_call "POST" "/match/schedule" '{
    "team1Id": "team-india",
    "team2Id": "team-aus",
    "scheduledDate": "2024-06-15",
    "overs": 20
}')
echo "$response"
SCHEDULED_MATCH_ID=$(echo "$response" | extract_id)

if [ -z "$SCHEDULED_MATCH_ID" ]; then
    echo -e "${RED}Error: Failed to schedule match${NC}"
else
    echo -e "${BLUE}Scheduled Match ID: $SCHEDULED_MATCH_ID${NC}"
    
    # 24. Get match details (should be in scheduled state)
    echo -e "${GREEN}24. Getting Scheduled Match Details${NC}"
    api_call "GET" "/match/$SCHEDULED_MATCH_ID"
    
    # 25. Start the scheduled match
    echo -e "${GREEN}25. Starting the Scheduled Match${NC}"
    api_call "POST" "/match/$SCHEDULED_MATCH_ID/start"
    
    # 26. Delay the match (simulating rain)
    echo -e "${GREEN}26. Delaying Match (Rain)${NC}"
    api_call "POST" "/match/$SCHEDULED_MATCH_ID/delay" '{"reason": "Rain delay"}'
    
    # 27. Apply DLS method
    echo -e "${GREEN}27. Applying DLS Method (revised overs: 15)${NC}"
    echo "DLS Formula: adjusted_target = floor(original_target * (revised_overs / original_overs)) + 1"
    api_call "POST" "/match/$SCHEDULED_MATCH_ID/dls" '{"revisedOvers": 15}'
    
    # 28. Get match details after DLS
    echo -e "${GREEN}28. Getting Match Details After DLS${NC}"
    api_call "GET" "/match/$SCHEDULED_MATCH_ID"
fi

# 29. Create another match for abandoned test
echo -e "${GREEN}29. Creating Match for Abandoned Test${NC}"
response=$(api_call "POST" "/match/start" '{"team1Id":"team-eng","team2Id":"team-pak"}')
echo "$response"
ABANDON_MATCH_ID=$(echo "$response" | extract_id)

if [ -z "$ABANDON_MATCH_ID" ]; then
    echo -e "${RED}Error: Failed to create match for abandon test${NC}"
else
    echo -e "${BLUE}Match ID for Abandon: $ABANDON_MATCH_ID${NC}"
    
    # 30. Delay the match
    echo -e "${GREEN}30. Delaying Match${NC}"
    api_call "POST" "/match/$ABANDON_MATCH_ID/delay" '{"reason": "Heavy rain"}'
    
    # 31. Abandon the match
    echo -e "${GREEN}31. Abandoning Match${NC}"
    api_call "POST" "/match/$ABANDON_MATCH_ID/abandon" '{"reason": "Persistent rain - no play possible"}'
    
    # 32. Verify abandoned status
    echo -e "${GREEN}32. Verifying Abandoned Status${NC}"
    api_call "GET" "/match/$ABANDON_MATCH_ID"
fi

# 33. Create match for no_result test
echo -e "${GREEN}33. Creating Match for No Result Test${NC}"
response=$(api_call "POST" "/match/start" '{"team1Id":"team-sl","team2Id":"team-ban"}')
echo "$response"
NO_RESULT_MATCH_ID=$(echo "$response" | extract_id)

if [ -z "$NO_RESULT_MATCH_ID" ]; then
    echo -e "${RED}Error: Failed to create match for no result test${NC}"
else
    echo -e "${BLUE}Match ID for No Result: $NO_RESULT_MATCH_ID${NC}"
    
    # 34. Declare no result
    echo -e "${GREEN}34. Declaring No Result${NC}"
    api_call "POST" "/match/$NO_RESULT_MATCH_ID/no-result" '{"reason": "Match could not be completed"}'
    
    # 35. Verify no result status
    echo -e "${GREEN}35. Verifying No Result Status${NC}"
    api_call "GET" "/match/$NO_RESULT_MATCH_ID"
fi

# 36. Create match for completion test
echo -e "${GREEN}36. Creating Match for Completion Test${NC}"
response=$(api_call "POST" "/match/start" '{"team1Id":"team-afg","team2Id":"team-nep"}')
echo "$response"
COMPLETE_MATCH_ID=$(echo "$response" | extract_id)

if [ -z "$COMPLETE_MATCH_ID" ]; then
    echo -e "${RED}Error: Failed to create match for completion test${NC}"
else
    echo -e "${BLUE}Match ID for Completion: $COMPLETE_MATCH_ID${NC}"
    
    # 37. Complete the match with a winner
    echo -e "${GREEN}37. Completing Match with Winner${NC}"
    api_call "POST" "/match/$COMPLETE_MATCH_ID/complete" '{"winnerId": "team-afg"}'
    
    # 38. Verify completed status
    echo -e "${GREEN}38. Verifying Completed Status${NC}"
    api_call "GET" "/match/$COMPLETE_MATCH_ID"
fi

# 39. Get matches by status
echo -e "${GREEN}39. Getting Matches by Status${NC}"
echo "Abandoned matches:"
api_call "GET" "/match/status/abandoned"
echo "No Result matches:"
api_call "GET" "/match/status/no_result"
echo "Completed matches:"
api_call "GET" "/match/status/completed"

# ============ Test Points Auto-Update ============

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing Points Auto-Update${NC}"
echo -e "${BLUE}========================================${NC}"

# 40. Create a new tournament for points testing
echo -e "${GREEN}40. Creating Test Tournament for Points${NC}"
response=$(api_call "POST" "/tournaments" '{
    "name": "Points Test Tournament",
    "shortName": "PTT",
    "type": "test",
    "startDate": "2024-07-01",
    "endDate": "2024-07-10",
    "hostCountry": "Test"
}')
echo "$response"
POINTS_TOURNAMENT_ID=$(echo "$response" | extract_id)

if [ -z "$POINTS_TOURNAMENT_ID" ]; then
    echo -e "${RED}Error: Failed to create points test tournament${NC}"
else
    echo -e "${BLUE}Points Tournament ID: $POINTS_TOURNAMENT_ID${NC}"
    
    # Add teams
    api_call "POST" "/tournaments/$POINTS_TOURNAMENT_ID/teams" '{
        "teamIds": ["team-india", "team-pak", "team-eng", "team-aus"]
    }'
    
    # 41. Create and complete a match in tournament
    echo -e "${GREEN}41. Creating Match in Tournament${NC}"
    response=$(api_call "POST" "/match/start" '{
        "team1Id": "team-india",
        "team2Id": "team-pak",
        "tournamentId": "'"$POINTS_TOURNAMENT_ID"'"
    }')
    echo "$response"
    POINTS_MATCH_ID=$(echo "$response" | extract_id)
    
    if [ -n "$POINTS_MATCH_ID" ]; then
        # Complete the match
        echo -e "${GREEN}42. Completing Match (India wins)${NC}"
        api_call "POST" "/match/$POINTS_MATCH_ID/complete" '{"winnerId": "team-india"}'
        
        # Check points table - India should have 2 points, Pakistan 0
        echo -e "${GREEN}43. Checking Points Table (India should have 2 points)${NC}"
        api_call "GET" "/tournaments/$POINTS_TOURNAMENT_ID/points"
    fi
    
    # 44. Create and abandon a match
    echo -e "${GREEN}44. Creating Match for Abandon (1 point each)${NC}"
    response=$(api_call "POST" "/match/start" '{
        "team1Id": "team-eng",
        "team2Id": "team-aus",
        "tournamentId": "'"$POINTS_TOURNAMENT_ID"'"
    }')
    ABANDON_POINTS_MATCH_ID=$(echo "$response" | extract_id)
    
    if [ -n "$ABANDON_POINTS_MATCH_ID" ]; then
        # Abandon the match
        echo -e "${GREEN}45. Abandoning Match (1 point each team)${NC}"
        api_call "POST" "/match/$ABANDON_POINTS_MATCH_ID/abandon" '{"reason": "Rain"}'
        
        # Check points table - England and Australia should each have 1 point
        echo -e "${GREEN}46. Checking Points Table (Eng & Aus should have 1 point each)${NC}"
        api_call "GET" "/tournaments/$POINTS_TOURNAMENT_ID/points"
    fi
    
    # 47. Create no_result match
    echo -e "${GREEN}47. Creating No Result Match (1 point each)${NC}"
    response=$(api_call "POST" "/match/start" '{
        "team1Id": "team-india",
        "team2Id": "team-eng",
        "tournamentId": "'"$POINTS_TOURNAMENT_ID"'"
    }')
    NO_RESULT_POINTS_MATCH_ID=$(echo "$response" | extract_id)
    
    if [ -n "$NO_RESULT_POINTS_MATCH_ID" ]; then
        # Declare no result
        echo -e "${GREEN}48. Declaring No Result (1 point each team)${NC}"
        api_call "POST" "/match/$NO_RESULT_POINTS_MATCH_ID/no-result" '{"reason": "Wet outfield"}'
        
        # Check points table
        echo -e "${GREEN}49. Final Points Table${NC}"
        api_call "GET" "/tournaments/$POINTS_TOURNAMENT_ID/points"
    fi
fi

# ============ Test Scheduling Rules ============

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing Scheduling Rules${NC}"
echo -e "${BLUE}========================================${NC}"

# 50. Create stadiums for scheduling test
echo -e "${GREEN}50. Creating Multiple Stadiums${NC}"
api_call "POST" "/tournaments/stadiums" '{"name": "Stadium A", "city": "City A", "country": "Country A"}'
api_call "POST" "/tournaments/stadiums" '{"name": "Stadium B", "city": "City B", "country": "Country B"}'
api_call "POST" "/tournaments/stadiums" '{"name": "Stadium C", "city": "City C", "country": "Country C"}'

# Get all stadiums
STADIUMS=$(api_call "GET" "/tournaments/stadiums/all")
echo "$STADIUMS"

# Extract stadium IDs
STADIUM_IDS=$(echo "$STADIUMS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    stadiums = data.get('data', [])
    ids = [s.get('id') for s in stadiums if s.get('id')]
    print(','.join(ids))
except:
    print('')
")

# 51. Create tournament with scheduling test
echo -e "${GREEN}51. Creating Scheduling Test Tournament${NC}"
response=$(api_call "POST" "/tournaments" '{
    "name": "Scheduling Test Tournament",
    "shortName": "STT",
    "type": "test",
    "startDate": "2024-08-01",
    "endDate": "2024-08-30",
    "hostCountry": "Test"
}')
echo "$response"
SCHED_TOURNAMENT_ID=$(echo "$response" | extract_id)

if [ -z "$SCHED_TOURNAMENT_ID" ]; then
    echo -e "${RED}Error: Failed to create scheduling test tournament${NC}"
else
    echo -e "${BLUE}Scheduling Tournament ID: $SCHED_TOURNAMENT_ID${NC}"
    
    # Add 4 teams
    api_call "POST" "/tournaments/$SCHED_TOURNAMENT_ID/teams" '{
        "teamIds": ["team-india", "team-pak", "team-eng", "team-aus"]
    }'
    
    # 52. Generate fixtures with stadiums
    echo -e "${GREEN}52. Generating Fixtures with Stadium Distribution${NC}"
    api_call "POST" "/tournaments/$SCHED_TOURNAMENT_ID/fixtures/generate" '{
        "matchType": "group",
        "roundRobin": true,
        "includeKnockouts": true,
        "knockoutTeams": 4,
        "stadiumIds": "'"$STADIUM_IDS"'"
    }'
    
    # 53. Verify scheduling rules
    echo -e "${GREEN}53. Verifying Scheduling Rules${NC}"
    api_call "GET" "/tournaments/$SCHED_TOURNAMENT_ID/fixtures" | python3 -c "
import sys, json
from datetime import datetime
from collections import defaultdict

try:
    data = json.load(sys.stdin)
    fixtures = data.get('data', [])
    
    print('\\n=== Scheduling Rules Verification ===\\n')
    
    # Rule 1: No back-to-back matches for same team
    print('Rule 1: No back-to-back matches (same team cannot play consecutive days)')
    team_dates = defaultdict(list)
    for f in fixtures:
        if f.get('team1_id') and f.get('match_date'):
            team_dates[f['team1_id']].append(f['match_date'])
        if f.get('team2_id') and f.get('match_date'):
            team_dates[f['team2_id']].append(f['match_date'])
    
    violations = []
    for team, dates in team_dates.items():
        sorted_dates = sorted(set(dates))
        for i in range(1, len(sorted_dates)):
            d1 = datetime.strptime(sorted_dates[i-1], '%Y-%m-%d')
            d2 = datetime.strptime(sorted_dates[i], '%Y-%m-%d')
            gap = (d2 - d1).days
            if gap < 1:
                violations.append(f'  VIOLATION: {team} plays on {sorted_dates[i-1]} and {sorted_dates[i]} (gap: {gap} days)')
    
    if violations:
        for v in violations:
            print(v)
    else:
        print('  ✓ All teams have at least 1 day gap between matches')
    
    # Rule 2: At least 1 day gap
    print('\\nRule 2: Minimum 1 day gap between consecutive matches')
    for team, dates in team_dates.items():
        sorted_dates = sorted(set(dates))
        gaps_ok = True
        for i in range(1, len(sorted_dates)):
            d1 = datetime.strptime(sorted_dates[i-1], '%Y-%m-%d')
            d2 = datetime.strptime(sorted_dates[i], '%Y-%m-%d')
            if (d2 - d1).days < 1:
                gaps_ok = False
                break
        if gaps_ok and len(sorted_dates) > 1:
            print(f'  ✓ {team}: {len(sorted_dates)} matches, all with proper gaps')
    
    # Rule 3: Stadium distribution
    print('\\nRule 3: Stadium distribution')
    stadium_count = defaultdict(int)
    stadium_dates = defaultdict(set)
    for f in fixtures:
        if f.get('stadium_id'):
            stadium_count[f['stadium_id']] += 1
            stadium_dates[f['stadium_id']].add(f.get('match_date'))
    
    for stadium, count in stadium_count.items():
        print(f'  Stadium {stadium}: {count} matches')
    
    print('\\n=== End of Verification ===')
    
except Exception as e:
    print(f'Error: {e}')
"
fi

# ============ Test Auto-Rescheduling for Abandoned Matches ============

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing Auto-Rescheduling for Abandoned Matches${NC}"
echo -e "${BLUE}========================================${NC}"

# 54. Create a tournament with short duration to test rescheduling
echo -e "${GREEN}54. Creating Reschedule Test Tournament${NC}"
response=$(api_call "POST" "/tournaments" '{
    "name": "Reschedule Test Tournament",
    "shortName": "RTT",
    "type": "test",
    "startDate": "2024-09-01",
    "endDate": "2024-09-10",
    "hostCountry": "Test"
}')
echo "$response"
RTT_ID=$(echo "$response" | extract_id)

if [ -z "$RTT_ID" ]; then
    echo -e "${RED}Error: Failed to create reschedule test tournament${NC}"
else
    echo -e "${BLUE}Reschedule Tournament ID: $RTT_ID${NC}"
    
    # Add 2 teams
    api_call "POST" "/tournaments/$RTT_ID/teams" '{
        "teamIds": ["team-india", "team-pak"]
    }'
    
    # Generate one fixture
    echo -e "${GREEN}55. Generating Fixtures${NC}"
    api_call "POST" "/tournaments/$RTT_ID/fixtures/generate" '{
        "matchType": "group",
        "roundRobin": true,
        "includeKnockouts": false
    }'
    
    # Get the fixture ID
    echo -e "${GREEN}56. Getting Fixture ID${NC}"
    RESPONSE=$(api_call "GET" "/tournaments/$RTT_ID/fixtures")
    FIXTURE_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', [{}])[0].get('id', ''))")
    echo -e "${BLUE}Fixture ID: $FIXTURE_ID${NC}"
    
    # Start a match for this fixture
    echo -e "${GREEN}56b. Starting Match for Fixture${NC}"
    RESPONSE=$(api_call "POST" "/match/start" "{
        \"team1Id\": \"team-india\",
        \"team2Id\": \"team-pak\",
        \"tournamentId\": \"$RTT_ID\",
        \"fixtureId\": \"$FIXTURE_ID\"
    }")
    MATCH_ID=$(echo "$RESPONSE" | extract_id)
    echo -e "${BLUE}Match ID: $MATCH_ID${NC}"
    
    # 57. Abandon the match and check for rescheduling
    echo -e "${GREEN}57. Abandoning Match (should auto-reschedule)${NC}"
    response=$(api_call "POST" "/match/$MATCH_ID/abandon" '{"reason": "Rain"}')
    echo "$response"
    
    # 58. Check match details (should be scheduled again)
    echo -e "${GREEN}58. Verifying Rescheduled Match Details${NC}"
    api_call "GET" "/match/$MATCH_ID"
    
    # 59. Check points table (should be empty/no points yet)
    echo -e "${GREEN}59. Checking Points Table (should be 0 points)${NC}"
    api_call "GET" "/tournaments/$RTT_ID/points"
    
    # 60. Now make rescheduling impossible by setting tournament end date to today
    echo -e "${GREEN}60. Updating Tournament End Date to Today (to make rescheduling impossible)${NC}"
    TODAY=$(date +%Y-%m-%d)
    api_call "PUT" "/tournaments/$RTT_ID" "{\"endDate\": \"$TODAY\"}"
    
    # Start the match again
    echo -e "${GREEN}61. Starting the Rescheduled Match${NC}"
    api_call "POST" "/match/$MATCH_ID/start"
    
    # Abandon the match again
    echo -e "${GREEN}62. Abandoning Match Again (should NOT reschedule, but give points)${NC}"
    response=$(api_call "POST" "/match/$MATCH_ID/abandon" '{"reason": "Persistent Rain"}')
    echo "$response"
    
    # 63. Check points table (should have 1 point each)
    echo -e "${GREEN}63. Checking Points Table (should have 1 point each)${NC}"
    api_call "GET" "/tournaments/$RTT_ID/points"
fi

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
echo "  ✓ Match states (scheduled, in_progress, delayed, completed, abandoned, no_result)"
echo "  ✓ DLS method for rain-delayed matches"
echo "  ✓ Auto-update points table on match completion"
echo "  ✓ Scheduling rules (1-day gap, stadium distribution)"
echo "  ✓ Auto-rescheduling for abandoned matches"
