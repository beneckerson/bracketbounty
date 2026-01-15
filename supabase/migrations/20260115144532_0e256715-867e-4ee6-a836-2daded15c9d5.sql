-- Create competition_seasons table for dynamic season management
CREATE TABLE public.competition_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_key TEXT NOT NULL,
  season TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(competition_key, season)
);

-- Enable RLS
ALTER TABLE public.competition_seasons ENABLE ROW LEVEL SECURITY;

-- Anyone can view seasons (needed for pool creation)
CREATE POLICY "Anyone can view competition seasons"
ON public.competition_seasons
FOR SELECT
USING (true);

-- Only admins can manage seasons
CREATE POLICY "Admins can insert seasons"
ON public.competition_seasons
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update seasons"
ON public.competition_seasons
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete seasons"
ON public.competition_seasons
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Seed initial active seasons
INSERT INTO public.competition_seasons (competition_key, season, is_active) VALUES
  ('cfp', '2025-2026', true),
  ('nfl_playoffs', '2025-2026', true),
  ('nba_playoffs', '2025-2026', true),
  ('nhl_playoffs', '2025-2026', true),
  ('mlb_playoffs', '2026', true);