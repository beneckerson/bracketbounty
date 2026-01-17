import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting scheduled odds sync for all active competitions...');

    // Get distinct competition keys from pools that are in lobby or active status
    const { data: activePools, error: poolsError } = await supabase
      .from('pools')
      .select('competition_key')
      .in('status', ['lobby', 'active']);

    if (poolsError) {
      console.error('Error fetching active pools:', poolsError);
      throw poolsError;
    }

    if (!activePools || activePools.length === 0) {
      console.log('No active pools found, skipping sync');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active pools to sync',
          synced: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique competition keys
    const uniqueCompetitions = [...new Set(activePools.map(p => p.competition_key))];
    console.log(`Found ${uniqueCompetitions.length} active competitions:`, uniqueCompetitions);

    const syncResults: { competition_key: string; success: boolean; error?: string }[] = [];

    // Sync odds for each active competition
    for (const competitionKey of uniqueCompetitions) {
      try {
        console.log(`Syncing odds for competition: ${competitionKey}`);
        
        const { data, error } = await supabase.functions.invoke('sync-odds', {
          body: { competition_key: competitionKey }
        });

        if (error) {
          console.error(`Error syncing ${competitionKey}:`, error);
          syncResults.push({ 
            competition_key: competitionKey, 
            success: false, 
            error: error.message 
          });
        } else {
          console.log(`Successfully synced ${competitionKey}:`, data);
          syncResults.push({ 
            competition_key: competitionKey, 
            success: true 
          });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Exception syncing ${competitionKey}:`, err);
        syncResults.push({ 
          competition_key: competitionKey, 
          success: false, 
          error: errorMessage 
        });
      }
    }

    const successCount = syncResults.filter(r => r.success).length;
    console.log(`Sync complete: ${successCount}/${uniqueCompetitions.length} competitions synced successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${successCount}/${uniqueCompetitions.length} competitions`,
        synced: syncResults,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in sync-all-odds:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
