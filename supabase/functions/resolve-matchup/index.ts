import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResolveRequest {
  matchup_id: string;
  // Optional manual scores (if not fetching from API)
  home_score?: number;
  away_score?: number;
  // Optional manual winner override (for commissioner)
  manual_winner_member_id?: string;
  commissioner_note?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ResolveRequest = await req.json();
    const { matchup_id, home_score, away_score, manual_winner_member_id, commissioner_note } = body;

    if (!matchup_id) {
      throw new Error('matchup_id is required');
    }

    console.log(`Resolving matchup: ${matchup_id}`);

    // Get matchup with related data
    const { data: matchup, error: matchupError } = await supabase
      .from('pool_matchups')
      .select(`
        *,
        pool:pools(*),
        event:events(*)
      `)
      .eq('id', matchup_id)
      .single();

    if (matchupError || !matchup) {
      throw new Error(`Matchup not found: ${matchupError?.message}`);
    }

    const pool = matchup.pool;
    const event = matchup.event;

    if (!pool) {
      throw new Error('Pool not found for matchup');
    }

    // Get ownership records for this pool to determine which member owns which team
    const { data: ownerships, error: ownershipError } = await supabase
      .from('ownership')
      .select('*')
      .eq('pool_id', pool.id);

    if (ownershipError) {
      throw new Error(`Failed to fetch ownerships: ${ownershipError.message}`);
    }

    // Find owners for home and away teams
    const homeOwner = ownerships?.find(o => o.team_code === event?.home_team);
    const awayOwner = ownerships?.find(o => o.team_code === event?.away_team);

    // Get the locked spread for this event
    let lockedSpread: { home_spread: number; away_spread: number } | null = null;
    if (event?.id) {
      const { data: line } = await supabase
        .from('lines')
        .select('locked_line_payload')
        .eq('event_id', event.id)
        .single();

      if (line?.locked_line_payload) {
        lockedSpread = line.locked_line_payload as any;
      }
    }

    // Determine final scores
    let finalHomeScore = home_score ?? event?.final_home_score;
    let finalAwayScore = away_score ?? event?.final_away_score;

    if (finalHomeScore === undefined || finalAwayScore === undefined) {
      throw new Error('Final scores are required. Please provide home_score and away_score or wait for event to complete.');
    }

    // Determine winner based on pool mode and scoring rule
    let winnerMemberId: string | null = null;
    let decidedBy: 'straight' | 'ats' | null = null;
    let resultType: 'UPSET' | 'CAPTURED' | 'ADVANCES' | null = null;

    if (manual_winner_member_id) {
      // Manual override by commissioner
      winnerMemberId = manual_winner_member_id;
      decidedBy = null;
    } else if (pool.mode === 'capture' && pool.scoring_rule === 'ats' && lockedSpread) {
      // Capture mode with ATS - use spread to determine winner
      decidedBy = 'ats';

      // Calculate adjusted scores (score + spread)
      const homeAdjusted = finalHomeScore + lockedSpread.home_spread;
      const awayAdjusted = finalAwayScore + lockedSpread.away_spread;

      // The team that covers wins the matchup
      if (homeAdjusted > awayAdjusted) {
        // Home team covered
        winnerMemberId = homeOwner?.member_id || null;
        
        // Determine result type
        if (lockedSpread.home_spread < 0) {
          // Home was favorite and covered -> ADVANCES
          resultType = 'ADVANCES';
        } else {
          // Home was underdog and covered
          if (finalHomeScore > finalAwayScore) {
            // Underdog won outright -> UPSET
            resultType = 'UPSET';
          } else {
            // Underdog covered but lost -> CAPTURED
            resultType = 'CAPTURED';
          }
        }
      } else if (awayAdjusted > homeAdjusted) {
        // Away team covered
        winnerMemberId = awayOwner?.member_id || null;
        
        // Determine result type
        if (lockedSpread.away_spread < 0) {
          // Away was favorite and covered -> ADVANCES
          resultType = 'ADVANCES';
        } else {
          // Away was underdog and covered
          if (finalAwayScore > finalHomeScore) {
            // Underdog won outright -> UPSET
            resultType = 'UPSET';
          } else {
            // Underdog covered but lost -> CAPTURED
            resultType = 'CAPTURED';
          }
        }
      } else {
        // Push - game winner advances (ties go to the favorite effectively)
        decidedBy = 'ats';
        console.log('Push detected - game winner advances');
        
        if (finalHomeScore > finalAwayScore) {
          winnerMemberId = homeOwner?.member_id || null;
          resultType = 'ADVANCES';
        } else if (finalAwayScore > finalHomeScore) {
          winnerMemberId = awayOwner?.member_id || null;
          resultType = 'ADVANCES';
        }
        // True tie (same final score AND push on spread) - extremely rare, no winner
      }
    } else {
      // Standard mode or straight scoring - winner is team with higher score
      decidedBy = 'straight';
      if (finalHomeScore > finalAwayScore) {
        winnerMemberId = homeOwner?.member_id || null;
        resultType = 'ADVANCES';
      } else if (finalAwayScore > finalHomeScore) {
        winnerMemberId = awayOwner?.member_id || null;
        resultType = 'ADVANCES';
      }
    }

    // Update the matchup with the result
    const { error: updateError } = await supabase
      .from('pool_matchups')
      .update({
        winner_member_id: winnerMemberId,
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
        commissioner_note: commissioner_note || null,
      })
      .eq('id', matchup_id);

    if (updateError) {
      throw new Error(`Failed to update matchup: ${updateError.message}`);
    }

    // Update event with final scores if provided
    if (event?.id && (home_score !== undefined || away_score !== undefined)) {
      await supabase
        .from('events')
        .update({
          final_home_score: finalHomeScore,
          final_away_score: finalAwayScore,
          status: 'final',
          winner_team_code: finalHomeScore > finalAwayScore ? event.home_team : event.away_team,
        })
        .eq('id', event.id);
    }

    // Handle team capture/transfer in capture mode
    if (pool.mode === 'capture' && winnerMemberId) {
      const loserMemberId = winnerMemberId === homeOwner?.member_id 
        ? awayOwner?.member_id 
        : homeOwner?.member_id;
      
      const capturedTeamCode = winnerMemberId === homeOwner?.member_id
        ? event?.away_team
        : event?.home_team;

      if (loserMemberId && capturedTeamCode) {
        // Transfer ownership of losing team to winner
        const { error: captureError } = await supabase
          .from('ownership')
          .insert({
            pool_id: pool.id,
            member_id: winnerMemberId,
            team_code: capturedTeamCode,
            acquired_via: 'capture',
            from_matchup_id: matchup_id,
          });

        if (captureError) {
          console.error('Failed to create capture ownership:', captureError);
        }

        // Mark old ownership as inactive (or delete)
        await supabase
          .from('ownership')
          .delete()
          .eq('pool_id', pool.id)
          .eq('member_id', loserMemberId)
          .eq('team_code', capturedTeamCode);
      }
    }

    // Write audit log entry with detailed payload
    const { data: winnerMember } = await supabase
      .from('pool_members')
      .select('display_name')
      .eq('id', winnerMemberId)
      .single();

    // Get team names for better audit descriptions
    const { data: teamsData } = await supabase
      .from('teams')
      .select('code, name')
      .in('code', [event?.home_team, event?.away_team].filter(Boolean));
    
    const teamNames: Record<string, string> = {};
    teamsData?.forEach(t => { teamNames[t.code] = t.name; });

    // Determine underdog/favorite for audit payload
    const homeIsUnderdog = lockedSpread && lockedSpread.home_spread > 0;
    const underdogTeamCode = homeIsUnderdog ? event?.home_team : event?.away_team;
    const favoriteTeamCode = homeIsUnderdog ? event?.away_team : event?.home_team;
    const underdogSpread = homeIsUnderdog ? lockedSpread?.home_spread : lockedSpread?.away_spread;
    const underdogOwnerId = homeIsUnderdog ? homeOwner?.member_id : awayOwner?.member_id;
    const favoriteOwnerId = homeIsUnderdog ? awayOwner?.member_id : homeOwner?.member_id;

    // Build comprehensive audit payload
    const auditPayload: Record<string, unknown> = {
      matchup_id,
      winner_member_id: winnerMemberId,
      decided_by: decidedBy,
      result_type: resultType,
      home_score: finalHomeScore,
      away_score: finalAwayScore,
      spread: lockedSpread,
      winner_team: teamNames[winnerMemberId === homeOwner?.member_id ? event?.home_team! : event?.away_team!] || 'Unknown',
      loser_team: teamNames[winnerMemberId === homeOwner?.member_id ? event?.away_team! : event?.home_team!] || 'Unknown',
    };

    // Add capture-specific data for CAPTURED result type
    if (resultType === 'CAPTURED') {
      auditPayload.capturer_id = underdogOwnerId;
      auditPayload.captured_from_id = favoriteOwnerId;
      auditPayload.underdog_team = teamNames[underdogTeamCode!] || underdogTeamCode;
      auditPayload.favorite_team = teamNames[favoriteTeamCode!] || favoriteTeamCode;
      auditPayload.underdog_spread = underdogSpread;
    }

    // Add upset-specific data
    if (resultType === 'UPSET') {
      auditPayload.underdog_team = teamNames[underdogTeamCode!] || underdogTeamCode;
      auditPayload.underdog_spread = underdogSpread;
    }

    await supabase
      .from('audit_log')
      .insert({
        pool_id: pool.id,
        action_type: 'matchup_resolved',
        payload: auditPayload,
      });

    console.log(`Matchup resolved: ${resultType}, Winner: ${winnerMemberId}`);

    return new Response(
      JSON.stringify({
        success: true,
        matchup_id,
        winner_member_id: winnerMemberId,
        decided_by: decidedBy,
        result_type: resultType,
        home_score: finalHomeScore,
        away_score: finalAwayScore,
        spread: lockedSpread,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in resolve-matchup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
