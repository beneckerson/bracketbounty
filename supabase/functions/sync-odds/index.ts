import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map our competition keys to The Odds API sport keys
const SPORT_KEY_MAP: Record<string, string> = {
  'cfp': 'americanfootball_ncaaf',
  'nfl_playoffs': 'americanfootball_nfl',
  'nba_playoffs': 'basketball_nba',
  'nhl_playoffs': 'icehockey_nhl',
  'mlb_playoffs': 'baseball_mlb',
};

// Map API team names to our team codes
const TEAM_CODE_MAP: Record<string, { code: string; abbreviation: string; color: string }> = {
  // NFL Teams
  'Kansas City Chiefs': { code: 'KC', abbreviation: 'Chiefs', color: 'team-red' },
  'Buffalo Bills': { code: 'BUF', abbreviation: 'Bills', color: 'team-blue' },
  'Baltimore Ravens': { code: 'BAL', abbreviation: 'Ravens', color: 'team-purple' },
  'Philadelphia Eagles': { code: 'PHI', abbreviation: 'Eagles', color: 'team-green' },
  'San Francisco 49ers': { code: 'SF', abbreviation: '49ers', color: 'team-red' },
  'Detroit Lions': { code: 'DET', abbreviation: 'Lions', color: 'team-blue' },
  'Dallas Cowboys': { code: 'DAL', abbreviation: 'Cowboys', color: 'team-blue' },
  'Green Bay Packers': { code: 'GB', abbreviation: 'Packers', color: 'team-green' },
  'Miami Dolphins': { code: 'MIA', abbreviation: 'Dolphins', color: 'team-teal' },
  'Cleveland Browns': { code: 'CLE', abbreviation: 'Browns', color: 'team-orange' },
  'Houston Texans': { code: 'HOU', abbreviation: 'Texans', color: 'team-red' },
  'Pittsburgh Steelers': { code: 'PIT', abbreviation: 'Steelers', color: 'team-yellow' },
  'Los Angeles Rams': { code: 'LAR', abbreviation: 'Rams', color: 'team-blue' },
  'Tampa Bay Buccaneers': { code: 'TB', abbreviation: 'Buccaneers', color: 'team-red' },
  'Washington Commanders': { code: 'WAS', abbreviation: 'Commanders', color: 'team-red' },
  'Minnesota Vikings': { code: 'MIN_NFL', abbreviation: 'Vikings', color: 'team-purple' },
  'Denver Broncos': { code: 'DEN_NFL', abbreviation: 'Broncos', color: 'team-orange' },
  'Los Angeles Chargers': { code: 'LAC_NFL', abbreviation: 'Chargers', color: 'team-blue' },
  // NBA Teams
  'Boston Celtics': { code: 'BOS', abbreviation: 'Celtics', color: 'team-green' },
  'Milwaukee Bucks': { code: 'MIL', abbreviation: 'Bucks', color: 'team-green' },
  'Denver Nuggets': { code: 'DEN', abbreviation: 'Nuggets', color: 'team-blue' },
  'Phoenix Suns': { code: 'PHX', abbreviation: 'Suns', color: 'team-orange' },
  'Los Angeles Lakers': { code: 'LAL', abbreviation: 'Lakers', color: 'team-purple' },
  'Golden State Warriors': { code: 'GSW', abbreviation: 'Warriors', color: 'team-blue' },
  'Miami Heat': { code: 'MIA_NBA', abbreviation: 'Heat', color: 'team-red' },
  'Philadelphia 76ers': { code: 'PHI_NBA', abbreviation: '76ers', color: 'team-blue' },
  'New York Knicks': { code: 'NYK', abbreviation: 'Knicks', color: 'team-blue' },
  'Cleveland Cavaliers': { code: 'CLE_NBA', abbreviation: 'Cavaliers', color: 'team-red' },
  'Oklahoma City Thunder': { code: 'OKC', abbreviation: 'Thunder', color: 'team-blue' },
  'Dallas Mavericks': { code: 'DAL_NBA', abbreviation: 'Mavericks', color: 'team-blue' },
  'Sacramento Kings': { code: 'SAC', abbreviation: 'Kings', color: 'team-purple' },
  'Memphis Grizzlies': { code: 'MEM', abbreviation: 'Grizzlies', color: 'team-blue' },
  'Minnesota Timberwolves': { code: 'MIN', abbreviation: 'Timberwolves', color: 'team-blue' },
  'Los Angeles Clippers': { code: 'LAC', abbreviation: 'Clippers', color: 'team-blue' },
  // NHL Teams
  'Vegas Golden Knights': { code: 'VGK', abbreviation: 'Golden Knights', color: 'team-yellow' },
  'Florida Panthers': { code: 'FLA', abbreviation: 'Panthers', color: 'team-red' },
  'Edmonton Oilers': { code: 'EDM', abbreviation: 'Oilers', color: 'team-orange' },
  'Dallas Stars': { code: 'DAL_NHL', abbreviation: 'Stars', color: 'team-green' },
  'Boston Bruins': { code: 'BOS_NHL', abbreviation: 'Bruins', color: 'team-yellow' },
  'Carolina Hurricanes': { code: 'CAR', abbreviation: 'Hurricanes', color: 'team-red' },
  'New York Rangers': { code: 'NYR', abbreviation: 'Rangers', color: 'team-blue' },
  'Toronto Maple Leafs': { code: 'TOR', abbreviation: 'Maple Leafs', color: 'team-blue' },
  'Colorado Avalanche': { code: 'COL', abbreviation: 'Avalanche', color: 'team-red' },
  'Winnipeg Jets': { code: 'WPG', abbreviation: 'Jets', color: 'team-blue' },
  'Tampa Bay Lightning': { code: 'TBL', abbreviation: 'Lightning', color: 'team-blue' },
  'New Jersey Devils': { code: 'NJD', abbreviation: 'Devils', color: 'team-red' },
  // MLB Teams
  'Texas Rangers': { code: 'TEX', abbreviation: 'Rangers', color: 'team-blue' },
  'Arizona Diamondbacks': { code: 'ARI', abbreviation: 'Diamondbacks', color: 'team-red' },
  'Houston Astros': { code: 'HOU_MLB', abbreviation: 'Astros', color: 'team-orange' },
  'Atlanta Braves': { code: 'ATL', abbreviation: 'Braves', color: 'team-red' },
  'Los Angeles Dodgers': { code: 'LAD', abbreviation: 'Dodgers', color: 'team-blue' },
  'Philadelphia Phillies': { code: 'PHI_MLB', abbreviation: 'Phillies', color: 'team-red' },
  'Baltimore Orioles': { code: 'BAL_MLB', abbreviation: 'Orioles', color: 'team-orange' },
  'Minnesota Twins': { code: 'MIN_MLB', abbreviation: 'Twins', color: 'team-red' },
  'Tampa Bay Rays': { code: 'TBR', abbreviation: 'Rays', color: 'team-blue' },
  'Milwaukee Brewers': { code: 'MIL_MLB', abbreviation: 'Brewers', color: 'team-blue' },
  'Miami Marlins': { code: 'MIA_MLB', abbreviation: 'Marlins', color: 'team-blue' },
  'Toronto Blue Jays': { code: 'TOR_MLB', abbreviation: 'Blue Jays', color: 'team-blue' },
  // College Football Teams (common CFP contenders)
  'Notre Dame Fighting Irish': { code: 'ND', abbreviation: 'Notre Dame', color: 'team-blue' },
  'Ohio State Buckeyes': { code: 'OSU', abbreviation: 'Ohio State', color: 'team-red' },
  'Penn State Nittany Lions': { code: 'PSU', abbreviation: 'Penn State', color: 'team-blue' },
  'Georgia Bulldogs': { code: 'UGA', abbreviation: 'Georgia', color: 'team-red' },
  'Texas Longhorns': { code: 'TEX_CFB', abbreviation: 'Texas', color: 'team-orange' },
  'Oregon Ducks': { code: 'ORE', abbreviation: 'Oregon', color: 'team-green' },
  'Tennessee Volunteers': { code: 'TENN', abbreviation: 'Tennessee', color: 'team-orange' },
  'Clemson Tigers': { code: 'CLEM', abbreviation: 'Clemson', color: 'team-purple' },
  'Michigan Wolverines': { code: 'MICH', abbreviation: 'Michigan', color: 'team-blue' },
  'Alabama Crimson Tide': { code: 'BAMA', abbreviation: 'Alabama', color: 'team-red' },
  'Arizona State Sun Devils': { code: 'ASU', abbreviation: 'Arizona State', color: 'team-red' },
  'Indiana Hoosiers': { code: 'IND', abbreviation: 'Indiana', color: 'team-red' },
  'Boise State Broncos': { code: 'BSU', abbreviation: 'Boise State', color: 'team-blue' },
  'SMU Mustangs': { code: 'SMU', abbreviation: 'SMU', color: 'team-blue' },
};

function getTeamInfo(teamName: string): { code: string; abbreviation: string; color: string } {
  return TEAM_CODE_MAP[teamName] || { 
    code: teamName.substring(0, 3).toUpperCase(), 
    abbreviation: teamName.split(' ').pop() || teamName,
    color: 'team-gray' 
  };
}

// Detect NFL playoff round based on game date and total games in sync
function detectNFLPlayoffRound(startTime: Date, totalGames: number): { round_key: string; round_order: number } {
  const month = startTime.getMonth(); // 0-indexed (0 = January)
  const day = startTime.getDate();
  const year = startTime.getFullYear();
  
  console.log(`Detecting round for date: ${year}-${month + 1}-${day}, total games: ${totalGames}`);
  
  // NFL playoffs are in January-February
  if (month === 0) { // January
    // Wild Card: typically Jan 11-13 (Saturday-Monday of first weekend)
    if (day <= 14) {
      return { round_key: 'wild_card', round_order: 1 };
    }
    // Divisional: typically Jan 18-19 (Saturday-Sunday of second weekend)
    if (day <= 21) {
      return { round_key: 'divisional', round_order: 2 };
    }
    // Conference Championships: typically Jan 26 (Sunday of third weekend)
    return { round_key: 'conference', round_order: 3 };
  }
  
  // February = Super Bowl
  if (month === 1) { // February
    return { round_key: 'super_bowl', round_order: 4 };
  }
  
  // Fallback based on game count if date detection fails
  // Super Bowl = 1 game, Conference = 2 games, Divisional = 4 games, Wild Card = 6 games
  if (totalGames === 1) return { round_key: 'super_bowl', round_order: 4 };
  if (totalGames === 2) return { round_key: 'conference', round_order: 3 };
  if (totalGames === 4) return { round_key: 'divisional', round_order: 2 };
  
  // Default to wild card for 6 games or any other count
  return { round_key: 'wild_card', round_order: 1 };
}

// Detect round for other sports (NBA, NHL, MLB playoffs)
function detectSeriesPlayoffRound(competitionKey: string, totalGames: number): { round_key: string; round_order: number } {
  // For series-based playoffs, we use game count as primary indicator
  // NBA/NHL: 16 teams = 8 first round series, 4 second round, 2 conference finals, 1 finals
  // Each series has multiple games, but we're counting series not games
  
  if (competitionKey === 'nba_playoffs' || competitionKey === 'nhl_playoffs') {
    // 8 series = first round, 4 = second round, 2 = conference finals, 1 = finals
    if (totalGames <= 2) return { round_key: 'finals', round_order: 4 };
    if (totalGames <= 4) return { round_key: 'conference_finals', round_order: 3 };
    if (totalGames <= 8) return { round_key: 'second_round', round_order: 2 };
    return { round_key: 'first_round', round_order: 1 };
  }
  
  if (competitionKey === 'mlb_playoffs') {
    // MLB: Wild Card (4), Division Series (4), LCS (2), World Series (1)
    if (totalGames === 1) return { round_key: 'world_series', round_order: 4 };
    if (totalGames <= 2) return { round_key: 'lcs', round_order: 3 };
    if (totalGames <= 4) return { round_key: 'division_series', round_order: 2 };
    return { round_key: 'wild_card', round_order: 1 };
  }
  
  // Default
  return { round_key: 'regular', round_order: 1 };
}

// Detect CFP playoff round based on game date
function detectCFPPlayoffRound(startTime: Date, totalGames: number): { round_key: string; round_order: number } {
  const month = startTime.getMonth(); // 0-indexed
  const day = startTime.getDate();
  
  console.log(`CFP round detection for date: ${month + 1}/${day}, total games: ${totalGames}`);
  
  // CFP typically runs late December through early January
  // First Round: Dec 20-21 (4 games)
  // Quarterfinals: Dec 31 - Jan 1 (4 games)
  // Semifinals: Jan 9-10 (2 games)
  // Championship: Jan 20 (1 game)
  
  if (month === 11) { // December
    if (day <= 22) {
      return { round_key: 'first_round', round_order: 1 };
    }
    return { round_key: 'quarterfinals', round_order: 2 };
  }
  
  if (month === 0) { // January
    if (day <= 12) {
      return { round_key: 'semifinals', round_order: 3 };
    }
    return { round_key: 'championship', round_order: 4 };
  }
  
  // Fallback based on game count
  if (totalGames === 1) return { round_key: 'championship', round_order: 4 };
  if (totalGames === 2) return { round_key: 'semifinals', round_order: 3 };
  if (totalGames <= 4) return { round_key: 'quarterfinals', round_order: 2 };
  return { round_key: 'first_round', round_order: 1 };
}

// Main round detection function
function detectPlayoffRound(
  competitionKey: string, 
  startTime: Date, 
  totalGames: number
): { round_key: string; round_order: number } {
  if (competitionKey === 'cfp') {
    return detectCFPPlayoffRound(startTime, totalGames);
  }
  if (competitionKey === 'nfl_playoffs') {
    return detectNFLPlayoffRound(startTime, totalGames);
  }
  
  return detectSeriesPlayoffRound(competitionKey, totalGames);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const oddsApiKey = Deno.env.get('ODDS_API_KEY');
    if (!oddsApiKey) {
      throw new Error('ODDS_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { competition_key, markets = 'spreads' } = await req.json();
    
    if (!competition_key) {
      throw new Error('competition_key is required');
    }

    const sportKey = SPORT_KEY_MAP[competition_key];
    if (!sportKey) {
      throw new Error(`Unknown competition: ${competition_key}`);
    }

    console.log(`Syncing odds for ${competition_key} (${sportKey})`);

    // Fetch odds from The Odds API
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${oddsApiKey}&regions=us&markets=${markets}&oddsFormat=american`;
    
    const oddsResponse = await fetch(oddsUrl);
    if (!oddsResponse.ok) {
      const errorText = await oddsResponse.text();
      console.error('Odds API error:', errorText);
      throw new Error(`Odds API error: ${oddsResponse.status}`);
    }

    const oddsData = await oddsResponse.json();
    console.log(`Received ${oddsData.length} events from Odds API`);

    // Calculate total games for round detection
    const totalGames = oddsData.length;
    
    // Get the earliest start time to determine the round
    let referenceDate: Date | null = null;
    if (oddsData.length > 0) {
      referenceDate = new Date(oddsData[0].commence_time);
      for (const event of oddsData) {
        const eventDate = new Date(event.commence_time);
        if (eventDate < referenceDate) {
          referenceDate = eventDate;
        }
      }
    }

    const syncedEvents: any[] = [];
    const syncedLines: any[] = [];

    for (const event of oddsData) {
      const homeTeamInfo = getTeamInfo(event.home_team);
      const awayTeamInfo = getTeamInfo(event.away_team);
      
      // Detect the round for this event
      const eventStartTime = new Date(event.commence_time);
      const roundInfo = detectPlayoffRound(competition_key, eventStartTime, totalGames);
      
      console.log(`Event ${event.home_team} vs ${event.away_team} -> Round: ${roundInfo.round_key} (order: ${roundInfo.round_order})`);

      // Upsert event with detected round
      const eventData = {
        external_event_id: event.id,
        competition_key,
        round_key: roundInfo.round_key,
        round_order: roundInfo.round_order,
        home_team: homeTeamInfo.code,
        away_team: awayTeamInfo.code,
        start_time: event.commence_time,
        status: new Date(event.commence_time) > new Date() ? 'scheduled' : 'live',
        event_type: (competition_key === 'nfl_playoffs' || competition_key === 'cfp') ? 'game' : 'series',
      };

      const { data: upsertedEvent, error: eventError } = await supabase
        .from('events')
        .upsert(eventData, { 
          onConflict: 'external_event_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (eventError) {
        console.error('Error upserting event:', eventError);
        continue;
      }

      syncedEvents.push({
        ...upsertedEvent,
        home_team_name: event.home_team,
        away_team_name: event.away_team,
      });

      // Process bookmaker spreads
      if (event.bookmakers && event.bookmakers.length > 0) {
        // Prefer FanDuel, then DraftKings, then first available
        const preferredBooks = ['fanduel', 'draftkings', 'betmgm'];
        let selectedBookmaker = event.bookmakers[0];
        
        for (const preferred of preferredBooks) {
          const found = event.bookmakers.find((b: any) => b.key === preferred);
          if (found) {
            selectedBookmaker = found;
            break;
          }
        }

        const spreadMarket = selectedBookmaker.markets?.find((m: any) => m.key === 'spreads');
        if (spreadMarket) {
          const homeSpread = spreadMarket.outcomes?.find((o: any) => o.name === event.home_team);
          const awaySpread = spreadMarket.outcomes?.find((o: any) => o.name === event.away_team);

          if (homeSpread && awaySpread) {
            const lineData = {
              event_id: upsertedEvent.id,
              source: 'the-odds-api',
              book: selectedBookmaker.key,
              locked_line_payload: {
                home_spread: homeSpread.point,
                away_spread: awaySpread.point,
                home_team: event.home_team,
                away_team: event.away_team,
                fetched_at: new Date().toISOString(),
              },
            };

            const { data: upsertedLine, error: lineError } = await supabase
              .from('lines')
              .upsert(lineData, {
                onConflict: 'event_id',
                ignoreDuplicates: false
              })
              .select()
              .single();

            if (lineError) {
              console.error('Error upserting line:', lineError);
            } else {
              syncedLines.push(upsertedLine);
            }
          }
        }
      }
    }

    // Also sync to teams reference table if we want
    const teamsToUpsert = oddsData.flatMap((event: any) => [
      {
        code: getTeamInfo(event.home_team).code,
        name: event.home_team,
        abbreviation: getTeamInfo(event.home_team).abbreviation,
        color: getTeamInfo(event.home_team).color,
        league: competition_key.split('_')[0].toUpperCase(),
      },
      {
        code: getTeamInfo(event.away_team).code,
        name: event.away_team,
        abbreviation: getTeamInfo(event.away_team).abbreviation,
        color: getTeamInfo(event.away_team).color,
        league: competition_key.split('_')[0].toUpperCase(),
      },
    ]);

    // Deduplicate teams
    const uniqueTeams = teamsToUpsert.reduce((acc: any[], team: any) => {
      if (!acc.find(t => t.code === team.code)) {
        acc.push(team);
      }
      return acc;
    }, []);

    const { error: teamsError } = await supabase
      .from('teams')
      .upsert(uniqueTeams, { onConflict: 'code', ignoreDuplicates: true });

    if (teamsError) {
      console.log('Teams table may not exist yet, skipping team sync:', teamsError.message);
    }

    console.log(`Synced ${syncedEvents.length} events and ${syncedLines.length} lines`);

    return new Response(
      JSON.stringify({
        success: true,
        events_synced: syncedEvents.length,
        lines_synced: syncedLines.length,
        detected_round: referenceDate ? detectPlayoffRound(competition_key, referenceDate, totalGames) : null,
        events: syncedEvents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in sync-odds:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
