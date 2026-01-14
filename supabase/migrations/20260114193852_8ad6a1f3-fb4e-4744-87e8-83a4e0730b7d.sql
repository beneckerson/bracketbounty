-- Allow pool creators to delete members
CREATE POLICY "Creators can delete members" 
ON public.pool_members 
FOR DELETE 
USING (is_pool_creator(auth.uid(), pool_id));

-- Allow pool creators to delete their pools
CREATE POLICY "Creators can delete their pools" 
ON public.pools 
FOR DELETE 
USING (created_by = auth.uid());