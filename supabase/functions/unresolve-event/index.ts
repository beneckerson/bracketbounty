import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_id } = await req.json();
    if (!event_id) throw new Error('event_id is required');

    console.log(`Un-resolving event: ${event_id}`);

    // 1. Get the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error(`Event not found: ${eventError?.message}`);
    }

    // 2. Get all pool_matchups for this event
    const { data: matchups, error: matchupsError } = await supabase
      .from('pool_matchups')
      .select('id, pool_id, winner_member_id, decided_by')
      .eq('event_id', event_id);

    if (matchupsError) {
      throw new Error(`Failed to fetch matchups: ${matchupsError.message}`);
    }

    console.log(`Found ${matchups?.length || 0} matchups to un-resolve`);

    let unresolved = 0;

    for (const matchup of matchups || []) {
      // Delete capture ownership records from this matchup
      const { data: deletedCaptures } = await supabase
        .from('ownership')
        .delete()
        .eq('pool_id', matchup.pool_id)
        .eq('acquired_via', 'capture')
        .eq('from_matchup_id', matchup.id)
        .select();

      if (deletedCaptures?.length) {
        console.log(`Deleted ${deletedCaptures.length} capture records for matchup ${matchup.id}`);
      }

      // Delete audit_log entries for this matchup resolution
      await supabase
        .from('audit_log')
        .delete()
        .eq('pool_id', matchup.pool_id)
        .eq('action_type', 'matchup_resolved')
        .filter('payload->>matchup_id', 'eq', matchup.id);

      // Clear matchup resolution fields
      const { error: updateError } = await supabase
        .from('pool_matchups')
        .update({
          winner_member_id: null,
          decided_by: null,
          decided_at: null,
          commissioner_note: null,
        })
        .eq('id', matchup.id);

      if (updateError) {
        console.error(`Failed to clear matchup ${matchup.id}:`, updateError);
      } else {
        unresolved++;
      }
    }

    // 3. Reset the event itself
    const { error: resetError } = await supabase
      .from('events')
      .update({
        status: 'scheduled',
        final_home_score: null,
        final_away_score: null,
        winner_team_code: null,
      })
      .eq('id', event_id);

    if (resetError) {
      throw new Error(`Failed to reset event: ${resetError.message}`);
    }

    console.log(`Un-resolved ${unresolved} matchups, event reset to scheduled`);

    return new Response(
      JSON.stringify({
        success: true,
        event_id,
        home_team: event.home_team,
        away_team: event.away_team,
        matchups_unresolved: unresolved,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in unresolve-event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
