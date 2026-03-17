import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map league to Odds API sport key
const LEAGUE_TO_SPORT_KEY: Record<string, string> = {
  NFL: 'americanfootball_nfl',
  CFB: 'americanfootball_ncaaf',
  NBA: 'basketball_nba',
  NHL: 'icehockey_nhl',
  MLB: 'baseball_mlb',
};

// Hash a string to pick a color from the palette
const TEAM_COLOR_PALETTE = [
  'team-crimson', 'team-scarlet', 'team-red', 'team-green', 'team-orange',
  'team-navy', 'team-blue', 'team-purple', 'team-gold', 'team-teal',
];

function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return TEAM_COLOR_PALETTE[Math.abs(hash) % TEAM_COLOR_PALETTE.length];
}

// Parse team name from Odds API format
function parseTeamName(fullName: string): { name: string; abbreviation: string; code: string; color: string } {
  const parts = fullName.split(' ');
  
  // Build abbreviation: for multi-word names, use school initials + mascot
  // e.g. "Boston College Eagles" → "BC Eagles", "TCU Horned Frogs" → "TCU Horned Frogs"
  let abbreviation = fullName;
  if (parts.length === 1) {
    abbreviation = fullName.substring(0, 4).toUpperCase();
  } else if (parts.length === 2) {
    // "Duke Blue" → "Duke Blue" (keep as-is for short names)
    abbreviation = fullName;
  } else if (parts.length >= 3) {
    // "Boston College Eagles" → "BC Eagles"
    const mascot = parts[parts.length - 1];
    const schoolParts = parts.slice(0, -1);
    const initials = schoolParts.map(w => w[0]).join('');
    abbreviation = `${initials} ${mascot}`;
  }
  
  // Code is uppercase, no spaces
  const code = fullName.toUpperCase().replace(/\s+/g, '_');
  
  return {
    name: fullName,
    abbreviation,
    code,
    color: hashToColor(code),
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { league } = await req.json();
    
    if (!league || !LEAGUE_TO_SPORT_KEY[league]) {
      return new Response(
        JSON.stringify({ error: 'Invalid league. Valid options: NFL, CFB, NBA, NHL, MLB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sportKey = LEAGUE_TO_SPORT_KEY[league];
    const oddsApiKey = Deno.env.get('ODDS_API_KEY');
    
    if (!oddsApiKey) {
      return new Response(
        JSON.stringify({ error: 'ODDS_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch events from Odds API
    console.log(`Fetching events for ${league} (${sportKey})...`);
    const eventsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${oddsApiKey}`;
    
    const eventsResponse = await fetch(eventsUrl);
    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('Odds API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Odds API error: ${eventsResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const events = await eventsResponse.json();
    console.log(`Found ${events.length} events`);

    // Extract unique teams
    const teamsMap = new Map<string, { name: string; abbreviation: string; code: string }>();
    
    for (const event of events) {
      if (event.home_team) {
        const parsed = parseTeamName(event.home_team);
        teamsMap.set(parsed.code, parsed);
      }
      if (event.away_team) {
        const parsed = parseTeamName(event.away_team);
        teamsMap.set(parsed.code, parsed);
      }
    }

    const uniqueTeams = Array.from(teamsMap.values());
    console.log(`Found ${uniqueTeams.length} unique teams`);

    // Upsert teams to database
    let insertedCount = 0;
    let updatedCount = 0;

    for (const team of uniqueTeams) {
      const { data: existing } = await supabase
        .from('teams')
        .select('code')
        .eq('code', team.code)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('teams')
          .update({
            name: team.name,
            abbreviation: team.abbreviation,
            color: team.color,
          })
          .eq('code', team.code);
        updatedCount++;
      } else {
        await supabase
          .from('teams')
          .insert({
            code: team.code,
            name: team.name,
            abbreviation: team.abbreviation,
            league: league,
            color: team.color,
          });
        insertedCount++;
      }
    }

    console.log(`Synced teams: ${insertedCount} inserted, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        league,
        totalTeams: uniqueTeams.length,
        inserted: insertedCount,
        updated: updatedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error syncing teams:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
