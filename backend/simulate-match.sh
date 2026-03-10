#!/bin/bash

# Live T20 Match Simulation for UI Demo
# Slower pace for better visibility in the browser

BASE_URL="http://localhost:3001/api"
MATCH_ID=""
DELAY=2 # 2 seconds between balls for live demo

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Live T20 Match Simulation (Demo)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Start match
echo -e "${GREEN}Starting Match...${NC}"
response=$(curl -s -X POST "$BASE_URL/match/start" \
    -H "Content-Type: application/json" \
    -d '{"team1Id":"team-india","team2Id":"team-sa"}')
MATCH_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo -e "${YELLOW}----------------------------------------${NC}"
echo -e "${YELLOW} MATCH ID: ${NC}${GREEN}$MATCH_ID${NC}"
echo -e "${YELLOW}----------------------------------------${NC}"
echo -e "Copy the Match ID above and paste it into the UI."
echo -e "Press Enter when you are ready to start the simulation..."
read

# Toss
curl -s -X POST "$BASE_URL/match/$MATCH_ID/toss" \
    -H "Content-Type: application/json" \
    -d '{"tossWinnerId":"team-india","tossDecision":"bat"}' > /dev/null

# Initialize 1st innings
curl -s -X POST "$BASE_URL/match/$MATCH_ID/innings/start" \
    -H "Content-Type: application/json" \
    -d '{"battingTeamId":"team-india","bowlingTeamId":"team-sa","strikerId":"ind-1","nonStrikerId":"ind-2","bowlerId":"sa-8"}' > /dev/null

echo -e "${GREEN}1st Innings: India batting${NC}"

# Simulate innings
simulate_innings() {
    local target=$1
    local is_chasing=$2
    local total_runs=0
    local wickets=0
    
    local batsmen=("ind-1" "ind-2" "ind-3" "ind-4" "ind-5" "ind-6" "ind-7" "ind-8" "ind-9" "ind-10" "ind-11")
    local bowlers=("sa-8" "sa-9" "sa-10" "sa-11" "sa-7")
    
    if [ "$is_chasing" = true ]; then
        batsmen=("sa-1" "sa-2" "sa-3" "sa-4" "sa-5" "sa-6" "sa-7" "sa-8" "sa-9" "sa-10" "sa-11")
        bowlers=("ind-8" "ind-9" "ind-10" "ind-11" "ind-5")
    fi
    
    local last_bowler_idx=-1
    
    for over in $(seq 0 19); do
        # Select a new bowler for each over (T20 rule: no consecutive overs)
        # Also ensure no bowler exceeds 4 overs (T20 rule)
        # Simplified rotation for simulation: cycle through 5 bowlers
        local bowler_idx=$(( over % 5 ))
        if [ $bowler_idx -eq $last_bowler_idx ]; then
             bowler_idx=$(( (bowler_idx + 1) % 5 ))
        fi
        
        if [ $over -gt 0 ]; then
            curl -s -X POST "$BASE_URL/match/$MATCH_ID/bowler" \
                -H "Content-Type: application/json" \
                -d "{\"bowlerId\":\"${bowlers[$bowler_idx]}\"}" > /dev/null
        fi
        last_bowler_idx=$bowler_idx
        
        echo -e "${YELLOW}Over $((over + 1)) - Bowler: ${bowlers[$bowler_idx]}${NC}"

        for ball in $(seq 1 6); do
            # Weighted random scoring
            rand=$((RANDOM % 100))
            runs=0; is_wicket=false; extra_type=""; wicket_type=""
            
            if [ $rand -lt 40 ]; then runs=0
            elif [ $rand -lt 70 ]; then runs=1
            elif [ $rand -lt 85 ]; then runs=4
            elif [ $rand -lt 92 ]; then runs=6
            elif [ $rand -lt 96 ]; then runs=0; extra_type="wide"
            else is_wicket=true; wicket_type="bowled"
            fi
            
            # Send ball record
            json="{\"runs\":$runs"
            if [ -n "$extra_type" ]; then json="$json,\"extraType\":\"$extra_type\""; fi
            if [ "$is_wicket" = true ]; then json="$json,\"isWicket\":true,\"wicketType\":\"$wicket_type\""; fi
            json="$json}"
            
            curl -s -X POST "$BASE_URL/match/$MATCH_ID/ball" \
                -H "Content-Type: application/json" \
                -d "$json" > /dev/null
            
            # Update local totals for chase logic
            if [ -n "$extra_type" ]; then total_runs=$((total_runs + runs + 1))
            else total_runs=$((total_runs + runs)); fi
            
            if [ "$is_wicket" = true ]; then
                wickets=$((wickets + 1))
                if [ $wickets -lt 10 ]; then
                    curl -s -X POST "$BASE_URL/match/$MATCH_ID/batsman" \
                        -H "Content-Type: application/json" \
                        -d "{\"playerId\":\"${batsmen[$wickets+1]}\"}" > /dev/null
                fi
            fi
            
            if [ "$is_chasing" = true ] && [ $total_runs -gt $target ]; then
                echo $total_runs
                return
            fi
            if [ $wickets -ge 10 ]; then
                echo $total_runs
                return
            fi
            
            sleep $DELAY
        done
    done
    echo $total_runs
}

# Run simulation
total1=$(simulate_innings 0 false)
echo -e "${GREEN}1st Innings Complete: $total1 runs${NC}"

sleep 2

# Start 2nd innings
curl -s -X POST "$BASE_URL/match/$MATCH_ID/innings/start" \
    -H "Content-Type: application/json" \
    -d "{\"battingTeamId\":\"team-sa\",\"bowlingTeamId\":\"team-india\",\"strikerId\":\"sa-1\",\"nonStrikerId\":\"sa-2\",\"bowlerId\":\"ind-8\"}" > /dev/null

echo -e "${GREEN}2nd Innings: South Africa chasing $total1${NC}"
total2=$(simulate_innings $total1 true)

echo -e "${BLUE}Match Complete! Final Score: India $total1, South Africa $total2${NC}"
