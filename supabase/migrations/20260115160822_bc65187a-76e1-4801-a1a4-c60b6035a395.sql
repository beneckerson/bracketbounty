-- Function to claim guest membership when a user signs in
CREATE OR REPLACE FUNCTION public.claim_guest_membership(p_claim_token text)
RETURNS TABLE(pool_id uuid, pool_name text, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Update the pool_member record and return pool info
  RETURN QUERY
  UPDATE pool_members pm
  SET 
    user_id = auth.uid(),
    is_claimed = true,
    claim_token = NULL,
    guest_id = NULL
  FROM pools p
  WHERE pm.claim_token = p_claim_token
    AND pm.pool_id = p.id
    AND pm.is_claimed = false
  RETURNING p.id, p.name, pm.display_name;
END;
$$;