-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can join pools" ON pool_members;

-- Create a better policy that allows:
-- 1. Users to join pools themselves (user_id = auth.uid())
-- 2. Pool creators to add guests (user_id IS NULL and user is pool creator)
CREATE POLICY "Users can join pools or creators can add guests"
  ON pool_members
  FOR INSERT
  WITH CHECK (
    (user_id = auth.uid()) OR 
    (user_id IS NULL AND is_pool_creator(auth.uid(), pool_id))
  );