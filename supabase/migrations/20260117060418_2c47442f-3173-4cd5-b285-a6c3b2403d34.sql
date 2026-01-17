-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "System can insert audit log" ON public.audit_log;

-- Create a more permissive policy that allows:
-- 1. Pool creators to insert any audit log
-- 2. Pool members to insert their own member_joined events
CREATE POLICY "Members and creators can insert audit log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  is_pool_creator(auth.uid(), pool_id)
  OR (
    is_pool_member(auth.uid(), pool_id)
    AND action_type = 'member_joined'
    AND actor_user_id = auth.uid()
  )
);