-- Update join_pool_as_guest to also log member_joined event
CREATE OR REPLACE FUNCTION public.join_pool_as_guest(p_pool_id uuid, p_display_name text)
 RETURNS TABLE(member_id uuid, claim_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id UUID := gen_random_uuid();
  v_guest_id UUID := gen_random_uuid();
  v_claim_token TEXT := encode(extensions.gen_random_bytes(16), 'hex');
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
  
  -- Insert the new member
  INSERT INTO pool_members (id, pool_id, guest_id, display_name, is_claimed, claim_token, role)
  VALUES (v_member_id, p_pool_id, v_guest_id, p_display_name, false, v_claim_token, 'member');
  
  -- Log member_joined event
  INSERT INTO audit_log (pool_id, action_type, payload)
  VALUES (p_pool_id, 'member_joined', jsonb_build_object('display_name', p_display_name));
  
  RETURN QUERY SELECT v_member_id, v_claim_token;
END;
$function$;