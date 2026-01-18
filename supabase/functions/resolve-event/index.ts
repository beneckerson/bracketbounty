import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResolveEventRequest {
  event_id: string;
  home_score: number;
  away_score: number;
  commissioner_note?: string;
}

interface MatchupResolution {
  matchup_id: string;
  pool_name: string;
  winner_member_id: string | null;
  result_type: string | null;
  decided_by: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ResolveEventRequest = await req.json();
    const { event_id, home_score, away_score, commissioner_note } = body;

    if (!event_id) {
      throw new Error('event_id is required');
    }

    if (home_score === undefined || away_score === undefined) {
      throw new Error('home_score and away_score are required');
    }

    console.log(`Resolving event: ${event_id} with scores ${away_score}-${home_score}`);

    // 1. Get the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error(`Event not found: ${eventError?.message}`);
    }

    // Determine winner team
    const winnerTeamCode = home_score > away_score ? event.home_team : event.away_team;

    // 2. Update the event with final scores
    const { error: updateEventError } = await supabase
      .from('events')
      .update({
        final_home_score: home_score,
        final_away_score: away_score,
        status: 'final',
        winner_team_code: winnerTeamCode,
      })
      .eq('id', event_id);

    if (updateEventError) {
      throw new Error(`Failed to update event: ${updateEventError.message}`);
    }

    console.log(`Event updated: ${event.away_team} ${away_score} @ ${event.home_team} ${home_score}`);

    // 3. Find all unresolved pool_matchups for this event
    const { data: matchups, error: matchupsError } = await supabase
      .from('pool_matchups')
      .select(`
        *,
        pool:pools(*)
      `)
      .eq('event_id', event_id)
      .is('winner_member_id', null);

    if (matchupsError) {
      throw new Error(`Failed to fetch matchups: ${matchupsError.message}`);
    }

    console.log(`Found ${matchups?.length || 0} unresolved matchups for this event`);

    const resolutions: MatchupResolution[] = [];

    // 4. Resolve each matchup
    for (const matchup of matchups || []) {
      const pool = matchup.pool;
      if (!pool) {
        console.warn(`Matchup ${matchup.id} has no pool, skipping`);
        continue;
      }

      // Get ownership records for this pool
      const { data: ownerships } = await supabase
        .from('ownership')
        .select('*')
        .eq('pool_id', pool.id);

      const homeOwner = ownerships?.find(o => o.team_code === event.home_team);
      const awayOwner = ownerships?.find(o => o.team_code === event.away_team);

      // Get locked spread for this event
      let lockedSpread: { home_spread: number; away_spread: number } | null = null;
      const { data: line } = await supabase
        .from('lines')
        .select('locked_line_payload')
        .eq('event_id', event_id)
        .single();

      if (line?.locked_line_payload) {
        lockedSpread = line.locked_line_payload as any;
      }

      // Determine winner based on pool mode and scoring rule
      let winnerMemberId: string | null = null;
      let decidedBy: 'straight' | 'ats' | null = null;
      let resultType: 'UPSET' | 'CAPTURED' | 'ADVANCES' | null = null;

      if (pool.mode === 'capture' && pool.scoring_rule === 'ats' && lockedSpread) {
        decidedBy = 'ats';

        // Standard ATS: Apply home spread to home score only
        // If home is favorite (-1.5), they need to win by more than 1.5
        // homeAdjusted = 33 + (-1.5) = 31.5, compare to away raw score of 30
        const homeAdjusted = home_score + lockedSpread.home_spread;

        console.log(`ATS calculation: Home ${home_score} + (${lockedSpread.home_spread}) = ${homeAdjusted} vs Away ${away_score}`);

        if (homeAdjusted > away_score) {
          // Home covers the spread
          winnerMemberId = homeOwner?.member_id || null;
          if (lockedSpread.home_spread < 0) {
            // Favorite covered
            resultType = 'ADVANCES';
          } else {
            // Underdog covered - they either won outright (UPSET) or lost but covered (CAPTURED)
            resultType = home_score > away_score ? 'UPSET' : 'CAPTURED';
          }
        } else if (homeAdjusted < away_score) {
          // Away covers the spread
          winnerMemberId = awayOwner?.member_id || null;
          if (lockedSpread.home_spread > 0) {
            // Away was the favorite and covered
            resultType = 'ADVANCES';
          } else {
            // Away was underdog - they either won outright (UPSET) or lost but covered (CAPTURED)
            resultType = away_score > home_score ? 'UPSET' : 'CAPTURED';
          }
        } else {
          // Push - homeAdjusted === away_score
          console.log(`Push detected for matchup ${matchup.id}`);
        }
      } else {
        decidedBy = 'straight';
        if (home_score > away_score) {
          winnerMemberId = homeOwner?.member_id || null;
          resultType = 'ADVANCES';
        } else if (away_score > home_score) {
          winnerMemberId = awayOwner?.member_id || null;
          resultType = 'ADVANCES';
        }
      }

      // Update the matchup
      const { error: updateMatchupError } = await supabase
        .from('pool_matchups')
        .update({
          winner_member_id: winnerMemberId,
          decided_by: decidedBy,
          decided_at: new Date().toISOString(),
          commissioner_note: commissioner_note || null,
        })
        .eq('id', matchup.id);

      if (updateMatchupError) {
        console.error(`Failed to update matchup ${matchup.id}:`, updateMatchupError);
        continue;
      }

      // Handle team capture in capture mode
      if (pool.mode === 'capture' && winnerMemberId && resultType === 'CAPTURED') {
        const loserMemberId = winnerMemberId === homeOwner?.member_id 
          ? awayOwner?.member_id 
          : homeOwner?.member_id;
        
        const capturedTeamCode = winnerMemberId === homeOwner?.member_id
          ? event.away_team
          : event.home_team;

        if (loserMemberId && capturedTeamCode) {
          await supabase
            .from('ownership')
            .insert({
              pool_id: pool.id,
              member_id: winnerMemberId,
              team_code: capturedTeamCode,
              acquired_via: 'capture',
              from_matchup_id: matchup.id,
            });

          await supabase
            .from('ownership')
            .delete()
            .eq('pool_id', pool.id)
            .eq('member_id', loserMemberId)
            .eq('team_code', capturedTeamCode);
        }
      }

      // Write audit log
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
          },
        });

      resolutions.push({
        matchup_id: matchup.id,
        pool_name: pool.name,
        winner_member_id: winnerMemberId,
        result_type: resultType,
        decided_by: decidedBy,
      });

      console.log(`Resolved matchup ${matchup.id} in pool "${pool.name}": ${resultType}`);
    }

    console.log(`Event resolution complete: ${resolutions.length} matchups resolved`);

    return new Response(
      JSON.stringify({
        success: true,
        event_id,
        home_team: event.home_team,
        away_team: event.away_team,
        home_score,
        away_score,
        resolved_count: resolutions.length,
        resolutions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in resolve-event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
