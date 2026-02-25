import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const oddsApiKey = Deno.env.get('ODDS_API_KEY');
    if (!oddsApiKey) {
      throw new Error('ODDS_API_KEY not configured');
    }

    // The /events endpoint is free (no quota cost)
    const url = `https://api.the-odds-api.com/v4/sports/basketball_ncaab/events?apiKey=${oddsApiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Odds API error:', errorText);
      throw new Error(`Odds API error: ${response.status}`);
    }

    const events = await response.json();
    console.log(`Fetched ${events.length} NCAAB events`);

    return new Response(
      JSON.stringify({ success: true, events }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in fetch-ncaab-events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
