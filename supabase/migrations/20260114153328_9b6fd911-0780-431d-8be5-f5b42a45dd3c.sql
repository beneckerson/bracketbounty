-- Drop overly permissive lines policies
DROP POLICY IF EXISTS "Creators can manage lines" ON public.lines;
DROP POLICY IF EXISTS "Creators can update lines" ON public.lines;

-- Create proper lines policies that check pool creator status via event
CREATE OR REPLACE FUNCTION public.can_manage_line(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pool_matchups pm
    JOIN public.pools p ON p.id = pm.pool_id
    WHERE pm.event_id = _event_id AND p.created_by = _user_id
  ) OR public.has_role(_user_id, 'admin')
$$;

CREATE POLICY "Pool creators can insert lines" ON public.lines 
FOR INSERT TO authenticated 
WITH CHECK (public.can_manage_line(auth.uid(), event_id));

CREATE POLICY "Pool creators can update lines" ON public.lines 
FOR UPDATE TO authenticated 
USING (public.can_manage_line(auth.uid(), event_id));