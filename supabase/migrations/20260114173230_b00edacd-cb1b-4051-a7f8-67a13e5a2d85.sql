-- Create a function to lookup pool by invite code (bypasses RLS)
CREATE OR REPLACE FUNCTION public.lookup_pool_by_invite_code(code text)
RETURNS TABLE (
  id uuid,
  name text,
  competition_key text,
  season text,
  status pool_status,
  buyin_amount_cents integer,
  max_players integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.competition_key, p.season, p.status, p.buyin_amount_cents, p.max_players
  FROM pools p
  WHERE LOWER(p.invite_code) = LOWER(code)
  LIMIT 1;
$$;