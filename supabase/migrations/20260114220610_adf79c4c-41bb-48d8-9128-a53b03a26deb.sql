-- Create competition_rosters table for admin-managed team availability
CREATE TABLE public.competition_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_key TEXT NOT NULL,
  season TEXT NOT NULL,
  team_code TEXT NOT NULL,
  seed INTEGER,
  is_eliminated BOOLEAN DEFAULT false,
  eliminated_at TIMESTAMPTZ,
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES auth.users(id),
  
  UNIQUE(competition_key, season, team_code)
);

-- Enable RLS
ALTER TABLE public.competition_rosters ENABLE ROW LEVEL SECURITY;

-- Anyone can view rosters (commissioners need to see available teams)
CREATE POLICY "Anyone can view competition rosters"
ON public.competition_rosters
FOR SELECT
USING (true);

-- Only admins can insert rosters
CREATE POLICY "Admins can insert rosters"
ON public.competition_rosters
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update rosters
CREATE POLICY "Admins can update rosters"
ON public.competition_rosters
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete rosters
CREATE POLICY "Admins can delete rosters"
ON public.competition_rosters
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for efficient lookups
CREATE INDEX idx_competition_rosters_lookup 
ON public.competition_rosters(competition_key, season, is_eliminated);