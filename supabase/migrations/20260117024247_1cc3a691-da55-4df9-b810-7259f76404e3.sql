-- Part 1: Update RLS policies for reference data to allow anonymous access

-- Events are public sports data - anyone can view
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
CREATE POLICY "Anyone can view events" ON public.events 
  FOR SELECT TO anon, authenticated USING (true);

-- Teams are public reference data - anyone can view  
DROP POLICY IF EXISTS "Teams are viewable by everyone" ON public.teams;
CREATE POLICY "Teams are viewable by everyone" ON public.teams 
  FOR SELECT TO anon, authenticated USING (true);

-- Lines are public (spreads) - anyone can view
DROP POLICY IF EXISTS "Members can view lines for their pools" ON public.lines;
CREATE POLICY "Anyone can view lines" ON public.lines 
  FOR SELECT TO anon, authenticated USING (true);

-- Competition rosters (seeds) are public reference data
DROP POLICY IF EXISTS "Anyone can view competition rosters" ON public.competition_rosters;
CREATE POLICY "Anyone can view competition rosters" ON public.competition_rosters 
  FOR SELECT TO anon, authenticated USING (true);

-- Part 2: Create SECURITY DEFINER function for pool-specific bracket data

CREATE OR REPLACE FUNCTION public.get_bracket_data_public(
  p_pool_id UUID, 
  p_claim_token TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Verify access via claim token OR authenticated user
  IF p_claim_token IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pool_members 
      WHERE pool_id = p_pool_id AND claim_token = p_claim_token
    ) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSIF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pool_members 
      WHERE pool_id = p_pool_id AND user_id = auth.uid()
    ) AND NOT EXISTS (
      SELECT 1 FROM pools 
      WHERE id = p_pool_id AND created_by = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Return all bracket data as JSON
  SELECT json_build_object(
    'rounds', (
      SELECT COALESCE(json_agg(r ORDER BY r.round_order), '[]'::json) FROM pool_rounds r 
      WHERE r.pool_id = p_pool_id
    ),
    'matchups', (
      SELECT COALESCE(json_agg(m), '[]'::json) FROM pool_matchups m 
      WHERE m.pool_id = p_pool_id
    ),
    'ownership', (
      SELECT COALESCE(json_agg(o), '[]'::json) FROM ownership o 
      WHERE o.pool_id = p_pool_id
    ),
    'audit_log', (
      SELECT COALESCE(json_agg(a ORDER BY a.created_at DESC), '[]'::json) FROM audit_log a 
      WHERE a.pool_id = p_pool_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;