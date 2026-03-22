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
      // Look up the audit_log entry for this matchup resolution to know what ownership to restore
      const { data: auditEntries } = await supabase
        .from('audit_log')
        .select('payload')
        .eq('pool_id', matchup.pool_id)
        .eq('action_type', 'matchup_resolved')
        .filter('payload->>matchup_id', 'eq', matchup.id);

      const auditPayload = auditEntries?.[0]?.payload as Record<string, unknown> | null;

      if (auditPayload) {
        const resultType = auditPayload.result_type as string;
        const winnerMemberId = auditPayload.winner_member_id as string;

        // Get team codes from the event
        const homeTeam = event.home_team;
        const awayTeam = event.away_team;

        // Determine loser info
        const loserMemberId = resultType === 'CAPTURED'
          ? auditPayload.captured_from_id as string
          : (winnerMemberId === auditPayload.winner_member_id
            ? null // we need to figure out loser from matchup participants
            : null);

        // Get the matchup participants to determine loser
        const { data: fullMatchup } = await supabase
          .from('pool_matchups')
          .select('participant_a_member_id, participant_b_member_id')
          .eq('id', matchup.id)
          .single();

        const participantA = fullMatchup?.participant_a_member_id;
        const participantB = fullMatchup?.participant_b_member_id;
        const loserMember = winnerMemberId === participantA ? participantB : participantA;

        // Determine which team belonged to the loser (the one that was eliminated)
        // We need ownership context - check which team the winner owns to infer the loser's team
        const winnerTeamCode = winnerMemberId === participantA
          ? homeTeam  // participant_a is typically home
          : awayTeam;
        const loserTeamCode = winnerTeamCode === homeTeam ? awayTeam : homeTeam;

        if (resultType === 'ADVANCES' || resultType === 'UPSET') {
          // Loser's team was eliminated — restore it
          if (loserMember && loserTeamCode) {
            console.log(`Restoring eliminated ownership: ${loserMember} → ${loserTeamCode}`);
            await supabase
              .from('ownership')
              .upsert({
                pool_id: matchup.pool_id,
                member_id: loserMember,
                team_code: loserTeamCode,
                acquired_via: 'initial',
              }, { onConflict: 'pool_id,member_id,team_code', ignoreDuplicates: true });
          }
        } else if (resultType === 'CAPTURED') {
          // In CAPTURED: 
          // 1. The favorite's team was captured by the underdog owner — delete the capture record (existing logic below handles this)
          // 2. The underdog's team lost the actual game and was eliminated — restore it to the winner (underdog owner)
          // 3. The favorite's team ownership needs to be restored to the original owner (favorite owner)
          
          const capturedFromId = auditPayload.captured_from_id as string || loserMember;
          
          // Restore the underdog's team (winner's team that was eliminated because it lost the game)
          if (winnerMemberId && winnerTeamCode) {
            console.log(`Restoring winner's eliminated team: ${winnerMemberId} → ${winnerTeamCode}`);
            await supabase
              .from('ownership')
              .upsert({
                pool_id: matchup.pool_id,
                member_id: winnerMemberId,
                team_code: winnerTeamCode,
                acquired_via: 'initial',
              }, { onConflict: 'pool_id,member_id,team_code', ignoreDuplicates: true });
          }

          // Restore the favorite's team back to the original owner (after capture record is deleted below)
          if (capturedFromId && loserTeamCode) {
            console.log(`Restoring captured team: ${capturedFromId} → ${loserTeamCode}`);
            await supabase
              .from('ownership')
              .upsert({
                pool_id: matchup.pool_id,
                member_id: capturedFromId,
                team_code: loserTeamCode,
                acquired_via: 'initial',
              }, { onConflict: 'pool_id,member_id,team_code', ignoreDuplicates: true });
          }
        }
      } else {
        console.log(`No audit_log entry found for matchup ${matchup.id} — skipping ownership restoration`);
      }

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
