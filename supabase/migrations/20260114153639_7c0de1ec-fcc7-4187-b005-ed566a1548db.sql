-- 1. Add winner tracking to pools table
ALTER TABLE public.pools 
ADD COLUMN IF NOT EXISTS winner_member_id UUID REFERENCES public.pool_members(id);

-- 2. Create helper function to check if venmo should be visible
CREATE OR REPLACE FUNCTION public.is_venmo_visible(_pool_id UUID, _member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Commissioner can always see all venmo handles
    public.is_pool_creator(auth.uid(), _pool_id)
    OR
    -- For completed pools, show winner's venmo to all pool members
    (
      EXISTS (
        SELECT 1 FROM public.pools 
        WHERE id = _pool_id 
        AND status = 'completed' 
        AND winner_member_id = _member_id
      )
      AND public.is_pool_member(auth.uid(), _pool_id)
    )
$$;

-- 3. Fix profiles: users can only view their own full profile
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles 
FOR SELECT TO authenticated 
USING (auth.uid() = id);

-- 4. Create public profiles view for display names only (no email/venmo)
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, display_name, created_at
FROM public.profiles;

-- 5. Update pool_members policies - members can view others in same pool
DROP POLICY IF EXISTS "Members can view pool members" ON public.pool_members;
DROP POLICY IF EXISTS "Users can view pool members they belong to" ON public.pool_members;
DROP POLICY IF EXISTS "Pool participants can view members" ON public.pool_members;

CREATE POLICY "Pool participants can view members" ON public.pool_members 
FOR SELECT TO authenticated 
USING (
  public.is_pool_member(auth.uid(), pool_id) 
  OR public.is_pool_creator(auth.uid(), pool_id)
);

-- 6. Create secure view for pool members that conditionally shows venmo
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
  claim_token
FROM public.pool_members;