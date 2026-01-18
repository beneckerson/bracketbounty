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

    console.log('Auto-lock-lines: Starting check for games that need lines locked...');

    const now = new Date().toISOString();

    // Find all events where:
    // - start_time <= now (game has started or is about to start)
    // - status is 'scheduled' or 'live'
    // - associated line exists but has locked_at IS NULL
    const { data: eventsToLock, error: fetchError } = await supabase
      .from('events')
      .select(`
        id,
        home_team,
        away_team,
        start_time,
        status,
        lines!inner(id, locked_at, locked_line_payload)
      `)
      .lte('start_time', now)
      .in('status', ['scheduled', 'live'])
      .is('lines.locked_at', null);

    if (fetchError) {
      throw new Error(`Failed to fetch events: ${fetchError.message}`);
    }

    console.log(`Found ${eventsToLock?.length || 0} events that need lines locked`);

    const lockedEvents: any[] = [];

    for (const event of eventsToLock || []) {
      const line = Array.isArray(event.lines) ? event.lines[0] : event.lines;
      
      if (!line || !line.locked_line_payload) {
        console.log(`Event ${event.id} (${event.away_team} @ ${event.home_team}) has no line payload, skipping`);
        continue;
      }

      console.log(`Locking line for event ${event.id}: ${event.away_team} @ ${event.home_team}`);

      // Lock the line by setting locked_at to now
      const { error: lockError } = await supabase
        .from('lines')
        .update({ locked_at: now })
        .eq('id', line.id);

      if (lockError) {
        console.error(`Failed to lock line for event ${event.id}:`, lockError);
        continue;
      }

      lockedEvents.push({
        event_id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        start_time: event.start_time,
        locked_at: now,
        spread: line.locked_line_payload,
      });

      console.log(`Successfully locked line for ${event.away_team} @ ${event.home_team}`);
    }

    console.log(`Auto-lock-lines complete: ${lockedEvents.length} lines locked`);

    return new Response(
      JSON.stringify({
        success: true,
        checked_at: now,
        events_checked: eventsToLock?.length || 0,
        lines_locked: lockedEvents.length,
        locked_events: lockedEvents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in auto-lock-lines:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
