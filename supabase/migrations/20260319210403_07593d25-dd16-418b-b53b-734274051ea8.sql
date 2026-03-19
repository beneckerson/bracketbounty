
-- Update get_pool_by_id_public to allow unauthenticated access (public read-only)
CREATE OR REPLACE FUNCTION public.get_pool_by_id_public(p_pool_id uuid, p_claim_token text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, competition_key text, season text, status pool_status, mode pool_mode, scoring_rule scoring_rule, buyin_amount_cents integer, max_players integer, teams_per_player integer, allocation_method allocation_method, invite_code text, payout_note text, created_by uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Pool data is publicly viewable by anyone with the pool ID
  RETURN QUERY
  SELECT 
    p.id, p.name, p.competition_key, p.season, p.status,
    p.mode, p.scoring_rule, p.buyin_amount_cents, p.max_players,
    p.teams_per_player, p.allocation_method, p.invite_code,
    p.payout_note, p.created_by, p.created_at
  FROM pools p
  WHERE p.id = p_pool_id;
END;
$function$;

-- Update get_pool_members_public to allow unauthenticated access (public read-only)
CREATE OR REPLACE FUNCTION public.get_pool_members_public(p_pool_id uuid, p_claim_token text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, display_name text, role member_role, is_claimed boolean, user_id uuid, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Pool members are publicly viewable by anyone with the pool ID
  RETURN QUERY
  SELECT 
    pm.id, pm.display_name, pm.role, pm.is_claimed, pm.user_id, pm.joined_at
  FROM pool_members pm
  WHERE pm.pool_id = p_pool_id
  ORDER BY pm.joined_at ASC;
END;
$function$;

-- Update get_bracket_data_public to allow unauthenticated access (public read-only)
CREATE OR REPLACE FUNCTION public.get_bracket_data_public(p_pool_id uuid, p_claim_token text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  -- Bracket data is publicly viewable by anyone with the pool ID
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
$function$;
