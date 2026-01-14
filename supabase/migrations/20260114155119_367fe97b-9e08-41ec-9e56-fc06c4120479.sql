-- Fix: Hide claim_token from pool_members_safe view
-- claim_token should only be visible via server-side operations (edge functions)
-- Not exposed to any pool members through direct queries

DROP VIEW IF EXISTS public.pool_members_safe;
CREATE VIEW public.pool_members_safe
WITH (security_invoker = on) AS
SELECT
  id,
  pool_id,
  user_id,
  guest_id,
  display_name,
  CASE
    WHEN public.is_venmo_visible(pool_id, id) THEN venmo_handle_copy
    ELSE NULL
  END as venmo_handle_copy,
  role,
  joined_at,
  is_claimed,
  -- claim_token is intentionally excluded - should only be used server-side
  NULL::text as claim_token
FROM public.pool_members;