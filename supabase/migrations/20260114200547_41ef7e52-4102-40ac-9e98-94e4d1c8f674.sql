-- Create a SECURITY DEFINER function for guest joining (bypasses RLS)
CREATE OR REPLACE FUNCTION public.join_pool_as_guest(
  p_pool_id UUID,
  p_display_name TEXT
)
RETURNS TABLE (
  member_id UUID,
  claim_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID := gen_random_uuid();
  v_guest_id UUID := gen_random_uuid();
  v_claim_token TEXT := encode(gen_random_bytes(16), 'hex');
BEGIN
  -- Verify pool exists and is in lobby status
  IF NOT EXISTS (
    SELECT 1 FROM pools 
    WHERE id = p_pool_id AND status = 'lobby'
  ) THEN
    RAISE EXCEPTION 'Pool not found or not accepting members';
  END IF;
  
  -- Check if pool is full
  IF (
    SELECT COUNT(*) FROM pool_members WHERE pool_id = p_pool_id
  ) >= COALESCE((SELECT max_players FROM pools WHERE id = p_pool_id), 999) THEN
    RAISE EXCEPTION 'Pool is full';
  END IF;
  
  INSERT INTO pool_members (id, pool_id, guest_id, display_name, is_claimed, claim_token, role)
  VALUES (v_member_id, p_pool_id, v_guest_id, p_display_name, false, v_claim_token, 'member');
  
  RETURN QUERY SELECT v_member_id, v_claim_token;
END;
$$;

-- Create a function to get pool details with member count (public access)
CREATE OR REPLACE FUNCTION public.get_pool_details_by_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  competition_key TEXT,
  season TEXT,
  status pool_status,
  buyin_amount_cents INTEGER,
  max_players INTEGER,
  mode pool_mode,
  scoring_rule scoring_rule,
  member_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id, p.name, p.competition_key, p.season, p.status, 
    p.buyin_amount_cents, p.max_players, p.mode, p.scoring_rule,
    (SELECT COUNT(*) FROM pool_members pm WHERE pm.pool_id = p.id)
  FROM pools p
  WHERE LOWER(p.invite_code) = LOWER(p_code)
  LIMIT 1;
$$;

-- Create a function for guests to access pool via claim token
CREATE OR REPLACE FUNCTION public.get_pool_for_guest(p_claim_token TEXT)
RETURNS TABLE (
  pool_id UUID,
  member_id UUID,
  display_name TEXT,
  pool_name TEXT,
  competition_key TEXT,
  season TEXT,
  status pool_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pm.pool_id, 
    pm.id as member_id, 
    pm.display_name,
    p.name as pool_name,
    p.competition_key,
    p.season,
    p.status
  FROM pool_members pm
  JOIN pools p ON p.id = pm.pool_id
  WHERE pm.claim_token = p_claim_token;
$$;

-- Create a function to get full pool data for guests (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_pool_by_id_public(p_pool_id UUID, p_claim_token TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  competition_key TEXT,
  season TEXT,
  status pool_status,
  mode pool_mode,
  scoring_rule scoring_rule,
  buyin_amount_cents INTEGER,
  max_players INTEGER,
  teams_per_player INTEGER,
  allocation_method allocation_method,
  invite_code TEXT,
  payout_note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access via claim token or is a member
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
      WHERE pools.id = p_pool_id AND created_by = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    p.id, p.name, p.competition_key, p.season, p.status,
    p.mode, p.scoring_rule, p.buyin_amount_cents, p.max_players,
    p.teams_per_player, p.allocation_method, p.invite_code,
    p.payout_note, p.created_by, p.created_at
  FROM pools p
  WHERE p.id = p_pool_id;
END;
$$;

-- Create a function to get pool members (bypasses RLS for guests)
CREATE OR REPLACE FUNCTION public.get_pool_members_public(p_pool_id UUID, p_claim_token TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  role member_role,
  is_claimed BOOLEAN,
  user_id UUID,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access via claim token or is a member
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
      WHERE pools.id = p_pool_id AND created_by = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    pm.id, pm.display_name, pm.role, pm.is_claimed, pm.user_id, pm.joined_at
  FROM pool_members pm
  WHERE pm.pool_id = p_pool_id
  ORDER BY pm.joined_at ASC;
END;
$$;