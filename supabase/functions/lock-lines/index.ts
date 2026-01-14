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

    const { event_id, matchup_id } = await req.json();

    if (!event_id && !matchup_id) {
      throw new Error('event_id or matchup_id is required');
    }

    let targetEventId = event_id;

    // If matchup_id provided, get the event_id from the matchup
    if (matchup_id && !event_id) {
      const { data: matchup, error: matchupError } = await supabase
        .from('pool_matchups')
        .select('event_id')
        .eq('id', matchup_id)
        .single();

      if (matchupError || !matchup?.event_id) {
        throw new Error('Matchup not found or has no associated event');
      }
      targetEventId = matchup.event_id;
    }

    console.log(`Locking lines for event: ${targetEventId}`);

    // Get current line for this event
    const { data: line, error: lineError } = await supabase
      .from('lines')
      .select('*')
      .eq('event_id', targetEventId)
      .single();

    if (lineError) {
      throw new Error(`Line not found for event: ${targetEventId}`);
    }

    if (line.locked_at) {
      console.log('Line already locked at:', line.locked_at);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Line was already locked',
          locked_at: line.locked_at,
          locked_line: line.locked_line_payload,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lock the line
    const { data: updatedLine, error: updateError } = await supabase
      .from('lines')
      .update({
        locked_at: new Date().toISOString(),
      })
      .eq('id', line.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to lock line: ${updateError.message}`);
    }

    console.log('Line locked successfully:', updatedLine);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Line locked successfully',
        locked_at: updatedLine.locked_at,
        locked_line: updatedLine.locked_line_payload,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in lock-lines:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
