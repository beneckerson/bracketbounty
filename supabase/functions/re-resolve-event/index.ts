import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReResolveEventRequest {
  event_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ReResolveEventRequest = await req.json();
    const { event_id } = body;

    if (!event_id) {
      throw new Error('event_id is required');
    }

    console.log(`Re-resolving event: ${event_id}`);

    // 1. Get the event with its final scores
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error(`Event not found: ${eventError?.message}`);
    }

    if (event.final_home_score === null || event.final_away_score === null) {
      throw new Error('Event does not have final scores set');
    }

    const home_score = event.final_home_score;
    const away_score = event.final_away_score;

    console.log(`Event scores: ${event.away_team} ${away_score} @ ${event.home_team} ${home_score}`);

    // 2. Get the corrected locked line
    const { data: line, error: lineError } = await supabase
      .from('lines')
      .select('locked_line_payload, locked_at')
      .eq('event_id', event_id)
      .single();

    if (lineError || !line?.locked_line_payload) {
      throw new Error(`No locked line found for event: ${lineError?.message}`);
    }

    const lockedSpread = line.locked_line_payload as { home_spread: number; away_spread: number };
    console.log(`Using corrected spread: Home ${lockedSpread.home_spread}, Away ${lockedSpread.away_spread}`);

    // 3. Find all pool_matchups for this event (already resolved)
    const { data: matchups, error: matchupsError } = await supabase
      .from('pool_matchups')
      .select(`
        *,
        pool:pools(*)
      `)
      .eq('event_id', event_id);

    if (matchupsError) {
      throw new Error(`Failed to fetch matchups: ${matchupsError.message}`);
    }

    console.log(`Found ${matchups?.length || 0} matchups for this event`);

    const resolutions: any[] = [];

    // 4. Process each matchup
    for (const matchup of matchups || []) {
      const pool = matchup.pool;
      if (!pool) {
        console.warn(`Matchup ${matchup.id} has no pool, skipping`);
        continue;
      }

      console.log(`Processing matchup ${matchup.id} in pool "${pool.name}"`);

      // 4a. Delete capture ownership records for this matchup
      const { data: deletedCaptures, error: deleteCaptureError } = await supabase
        .from('ownership')
        .delete()
        .eq('pool_id', pool.id)
        .eq('acquired_via', 'capture')
        .eq('from_matchup_id', matchup.id)
        .select();

      if (deleteCaptureError) {
        console.error(`Failed to delete captures for matchup ${matchup.id}:`, deleteCaptureError);
      } else {
        console.log(`Deleted ${deletedCaptures?.length || 0} capture ownership records`);
      }

      // 4b. Delete existing audit log entries for this matchup
      const { error: deleteAuditError } = await supabase
        .from('audit_log')
        .delete()
        .eq('pool_id', pool.id)
        .eq('action_type', 'matchup_resolved')
        .filter('payload->>matchup_id', 'eq', matchup.id);

      if (deleteAuditError) {
        console.error(`Failed to delete audit logs for matchup ${matchup.id}:`, deleteAuditError);
      }

      // 4c. Get current ownership records
      const { data: ownerships } = await supabase
        .from('ownership')
        .select('*')
        .eq('pool_id', pool.id);

      const homeOwner = ownerships?.find(o => o.team_code === event.home_team);
      const awayOwner = ownerships?.find(o => o.team_code === event.away_team);

      // 4d. Recalculate winner based on pool mode and corrected spread
      let winnerMemberId: string | null = null;
      let loserMemberId: string | null = null;
      let decidedBy: 'straight' | 'ats' | null = null;
      let resultType: 'UPSET' | 'CAPTURED' | 'ADVANCES' | null = null;
      let homeCovered = false;
      let awayCovered = false;

      if (pool.mode === 'capture' && pool.scoring_rule === 'ats' && lockedSpread) {
        decidedBy = 'ats';

        // Standard ATS: Apply home spread to home score only
        const homeAdjusted = home_score + lockedSpread.home_spread;

        console.log(`ATS calculation: Home ${home_score} + (${lockedSpread.home_spread}) = ${homeAdjusted} vs Away ${away_score}`);

        if (homeAdjusted > away_score) {
          // Home covers the spread
          homeCovered = true;
          winnerMemberId = homeOwner?.member_id || null;
          loserMemberId = awayOwner?.member_id || null;
          if (lockedSpread.home_spread < 0) {
            resultType = 'ADVANCES';
          } else {
            resultType = home_score > away_score ? 'UPSET' : 'CAPTURED';
          }
        } else if (homeAdjusted < away_score) {
          // Away covers the spread
          awayCovered = true;
          winnerMemberId = awayOwner?.member_id || null;
          loserMemberId = homeOwner?.member_id || null;
          if (lockedSpread.home_spread > 0) {
            resultType = 'ADVANCES';
          } else {
            resultType = away_score > home_score ? 'UPSET' : 'CAPTURED';
          }
        } else {
          console.log(`Push detected for matchup ${matchup.id}`);
        }
      } else {
        decidedBy = 'straight';
        if (home_score > away_score) {
          homeCovered = true;
          winnerMemberId = homeOwner?.member_id || null;
          loserMemberId = awayOwner?.member_id || null;
          resultType = 'ADVANCES';
        } else if (away_score > home_score) {
          awayCovered = true;
          winnerMemberId = awayOwner?.member_id || null;
          loserMemberId = homeOwner?.member_id || null;
          resultType = 'ADVANCES';
        }
      }

      console.log(`Recalculated: winner=${winnerMemberId}, loser=${loserMemberId}, resultType=${resultType}, decidedBy=${decidedBy}`);

      // 4e. Update the matchup with corrected resolution
      const { error: updateMatchupError } = await supabase
        .from('pool_matchups')
        .update({
          winner_member_id: winnerMemberId,
          decided_by: decidedBy,
          decided_at: new Date().toISOString(),
          commissioner_note: 'Re-resolved with corrected spread',
        })
        .eq('id', matchup.id);

      if (updateMatchupError) {
        console.error(`Failed to update matchup ${matchup.id}:`, updateMatchupError);
        continue;
      }

      // 4f. Handle team elimination/capture
      if (pool.mode === 'capture' && (homeCovered || awayCovered)) {
        const losingTeamCode = homeCovered ? event.away_team : event.home_team;
        
        // If it's a CAPTURED result AND winner exists, winner takes loser's team
        if (resultType === 'CAPTURED' && winnerMemberId && loserMemberId) {
          await supabase
            .from('ownership')
            .insert({
              pool_id: pool.id,
              member_id: winnerMemberId,
              team_code: losingTeamCode,
              acquired_via: 'capture',
              from_matchup_id: matchup.id,
            });

          await supabase
            .from('ownership')
            .delete()
            .eq('pool_id', pool.id)
            .eq('member_id', loserMemberId)
            .eq('team_code', losingTeamCode);
            
          console.log(`Team ${losingTeamCode} captured by winner`);
        } 
        // If loser exists but winner doesn't (unowned winning team), just eliminate loser
        else if (loserMemberId && !winnerMemberId) {
          await supabase
            .from('ownership')
            .delete()
            .eq('pool_id', pool.id)
            .eq('member_id', loserMemberId)
            .eq('team_code', losingTeamCode);
            
          console.log(`Team ${losingTeamCode} eliminated (loser lost to unowned team)`);
        }
        // Standard ADVANCES - the losing team is eliminated  
        else if (resultType === 'ADVANCES' && loserMemberId) {
          await supabase
            .from('ownership')
            .delete()
            .eq('pool_id', pool.id)
            .eq('member_id', loserMemberId)
            .eq('team_code', losingTeamCode);
            
          console.log(`Team ${losingTeamCode} eliminated (favorite advanced)`);
        }
      }

      // 4g. Write new audit log entry
      await supabase
        .from('audit_log')
        .insert({
          pool_id: pool.id,
          action_type: 'matchup_resolved',
          payload: {
            matchup_id: matchup.id,
            event_id,
            winner_member_id: winnerMemberId,
            decided_by: decidedBy,
            result_type: resultType,
            home_score,
            away_score,
            spread: lockedSpread,
            re_resolved: true,
          },
        });

      resolutions.push({
        matchup_id: matchup.id,
        pool_name: pool.name,
        winner_member_id: winnerMemberId,
        result_type: resultType,
        decided_by: decidedBy,
        previous_result: matchup.decided_by,
      });

      console.log(`Re-resolved matchup ${matchup.id} in pool "${pool.name}": ${resultType}`);
    }

    console.log(`Event re-resolution complete: ${resolutions.length} matchups updated`);

    return new Response(
      JSON.stringify({
        success: true,
        event_id,
        home_team: event.home_team,
        away_team: event.away_team,
        home_score,
        away_score,
        spread_used: lockedSpread,
        re_resolved_count: resolutions.length,
        resolutions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in re-resolve-event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
