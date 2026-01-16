import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RoundConfig {
  key: string;
  name: string;
  order: number;
}

// Round configurations by competition
const ROUND_CONFIGS: Record<string, RoundConfig[]> = {
  nfl_playoffs: [
    { key: 'wild_card', name: 'Wild Card', order: 1 },
    { key: 'divisional', name: 'Divisional', order: 2 },
    { key: 'conference', name: 'Conference Championship', order: 3 },
    { key: 'super_bowl', name: 'Super Bowl', order: 4 },
  ],
  cfp: [
    { key: 'first_round', name: 'First Round', order: 1 },
    { key: 'quarterfinals', name: 'Quarterfinals', order: 2 },
    { key: 'semifinals', name: 'Semifinals', order: 3 },
    { key: 'championship', name: 'Championship', order: 4 },
  ],
  nba_playoffs: [
    { key: 'first_round', name: 'First Round', order: 1 },
    { key: 'second_round', name: 'Conference Semifinals', order: 2 },
    { key: 'conference_finals', name: 'Conference Finals', order: 3 },
    { key: 'finals', name: 'NBA Finals', order: 4 },
  ],
  nhl_playoffs: [
    { key: 'first_round', name: 'First Round', order: 1 },
    { key: 'second_round', name: 'Second Round', order: 2 },
    { key: 'conference_finals', name: 'Conference Finals', order: 3 },
    { key: 'stanley_cup', name: 'Stanley Cup Final', order: 4 },
  ],
  mlb_playoffs: [
    { key: 'wild_card', name: 'Wild Card', order: 1 },
    { key: 'division', name: 'Division Series', order: 2 },
    { key: 'championship', name: 'Championship Series', order: 3 },
    { key: 'world_series', name: 'World Series', order: 4 },
  ],
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pool_id } = await req.json();

    if (!pool_id) {
      return new Response(
        JSON.stringify({ error: 'pool_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting pool ${pool_id} for user ${user.id}`);

    // 1. Fetch the pool and verify ownership
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('*')
      .eq('id', pool_id)
      .single();

    if (poolError || !pool) {
      console.error('Pool not found:', poolError);
      return new Response(
        JSON.stringify({ error: 'Pool not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pool.created_by !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the pool creator can start the pool' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pool.status !== 'lobby') {
      return new Response(
        JSON.stringify({ error: 'Pool must be in lobby status to start' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get pool members
    const { data: members, error: membersError } = await supabase
      .from('pool_members')
      .select('id, display_name')
      .eq('pool_id', pool_id);

    if (membersError || !members || members.length < 2) {
      console.error('Not enough members:', membersError);
      return new Response(
        JSON.stringify({ error: 'Need at least 2 players to start the pool' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${members.length} members`);

    // 3. Get selected teams
    const selectedTeams: string[] = pool.selected_teams || [];
    if (selectedTeams.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No teams selected for this pool' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3.5. Fetch team names for display
    const { data: teamsData } = await supabase
      .from('teams')
      .select('code, name, abbreviation')
      .in('code', selectedTeams);

    const teamNameMap: Record<string, { name: string; abbreviation: string }> = {};
    (teamsData || []).forEach((t: { code: string; name: string; abbreviation: string }) => {
      teamNameMap[t.code] = { name: t.name, abbreviation: t.abbreviation };
    });

    console.log(`Distributing ${selectedTeams.length} teams among ${members.length} members`);

    // 4. Randomly assign teams to members
    const shuffledTeams = [...selectedTeams].sort(() => Math.random() - 0.5);
    const ownershipRecords: Array<{
      pool_id: string;
      member_id: string;
      team_code: string;
      acquired_via: string;
    }> = [];

    // Build member lookup for assignments response
    const memberMap: Record<string, string> = {};
    members.forEach(m => { memberMap[m.id] = m.display_name; });

    // Track assignments for response
    const assignments: Array<{
      member_id: string;
      member_name: string;
      team_code: string;
      team_name: string;
      team_abbreviation: string;
    }> = [];

    shuffledTeams.forEach((teamCode, index) => {
      const memberIndex = index % members.length;
      const member = members[memberIndex];
      ownershipRecords.push({
        pool_id: pool_id,
        member_id: member.id,
        team_code: teamCode,
        acquired_via: 'initial',
      });
      assignments.push({
        member_id: member.id,
        member_name: member.display_name,
        team_code: teamCode,
        team_name: teamNameMap[teamCode]?.name || teamCode,
        team_abbreviation: teamNameMap[teamCode]?.abbreviation || teamCode.substring(0, 3).toUpperCase(),
      });
    });

    const { error: ownershipError } = await supabase
      .from('ownership')
      .insert(ownershipRecords);

    if (ownershipError) {
      console.error('Error creating ownership records:', ownershipError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign teams' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created ${ownershipRecords.length} ownership records`);

    // 5. Create pool rounds based on competition
    const roundConfigs = ROUND_CONFIGS[pool.competition_key] || ROUND_CONFIGS.nfl_playoffs;
    const roundInserts = roundConfigs.map(rc => ({
      pool_id: pool_id,
      round_key: rc.key,
      name: rc.name,
      round_order: rc.order,
    }));

    const { data: createdRounds, error: roundsError } = await supabase
      .from('pool_rounds')
      .insert(roundInserts)
      .select('id, round_key, round_order');

    if (roundsError) {
      console.error('Error creating rounds:', roundsError);
      return new Response(
        JSON.stringify({ error: 'Failed to create pool rounds' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created ${createdRounds?.length} rounds`);

    // 6. Fetch events that match the pool's teams and competition
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, home_team, away_team, round_key, round_order')
      .eq('competition_key', pool.competition_key)
      .or(`home_team.in.(${selectedTeams.join(',')}),away_team.in.(${selectedTeams.join(',')})`);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      // Not a fatal error - pool can still start without events
    }

    console.log(`Found ${events?.length || 0} matching events`);

    // 7. Create pool matchups for each event
    if (events && events.length > 0 && createdRounds) {
      // Build ownership lookup: team_code -> member_id
      const teamOwnerMap: Record<string, string> = {};
      ownershipRecords.forEach(o => {
        teamOwnerMap[o.team_code] = o.member_id;
      });

      // Build round lookup: round_key -> round_id
      const roundMap: Record<string, string> = {};
      createdRounds.forEach(r => {
        roundMap[r.round_key] = r.id;
      });

      const matchupInserts: Array<{
        pool_id: string;
        round_id: string;
        event_id: string;
        participant_a_member_id: string | null;
        participant_b_member_id: string | null;
      }> = [];

      for (const event of events) {
        // Find the matching round
        let roundId = roundMap[event.round_key];
        
        // If no exact match, use the round with matching order
        if (!roundId) {
          const matchingRound = createdRounds.find(r => r.round_order === event.round_order);
          if (matchingRound) {
            roundId = matchingRound.id;
            console.log(`[ROUND FALLBACK] Event ${event.id} (${event.round_key}) mapped to round ${matchingRound.round_key} via round_order=${event.round_order}`);
          } else {
            // Default to first round
            roundId = createdRounds[0].id;
            console.warn(`[ROUND MISMATCH] Event ${event.id} (${event.round_key}, order=${event.round_order}) - no matching round found, defaulting to first round`);
          }
        } else {
          console.log(`[ROUND MATCH] Event ${event.id} (${event.round_key}) -> pool_round ${roundId}`);
        }

        matchupInserts.push({
          pool_id: pool_id,
          round_id: roundId,
          event_id: event.id,
          participant_a_member_id: teamOwnerMap[event.home_team] || null,
          participant_b_member_id: teamOwnerMap[event.away_team] || null,
        });
      }

      if (matchupInserts.length > 0) {
        const { error: matchupsError } = await supabase
          .from('pool_matchups')
          .insert(matchupInserts);

        if (matchupsError) {
          console.error('Error creating matchups:', matchupsError);
          // Not fatal, pool can still start
        } else {
          console.log(`Created ${matchupInserts.length} matchups`);
        }
      }
    }

    // 8. Update pool status to active
    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'active' })
      .eq('id', pool_id);

    if (updateError) {
      console.error('Error updating pool status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to activate pool' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Log to audit
    await supabase.from('audit_log').insert({
      pool_id: pool_id,
      actor_user_id: user.id,
      action_type: 'pool_started',
      payload: {
        members_count: members.length,
        teams_count: selectedTeams.length,
        events_linked: events?.length || 0,
      },
    });

    console.log(`Pool ${pool_id} started successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        members_count: members.length,
        teams_assigned: ownershipRecords.length,
        rounds_created: createdRounds?.length || 0,
        matchups_created: events?.length || 0,
        assignments: assignments,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
