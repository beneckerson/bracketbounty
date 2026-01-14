-- Create teams reference table for consistent team display info
CREATE TABLE public.teams (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  color TEXT DEFAULT 'team-gray',
  league TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Teams are public read
CREATE POLICY "Teams are viewable by everyone" 
ON public.teams 
FOR SELECT 
USING (true);

-- Only admins can modify teams
CREATE POLICY "Admins can manage teams" 
ON public.teams 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Add unique constraint on external_event_id for upsert in sync-odds
ALTER TABLE public.events 
ADD CONSTRAINT events_external_event_id_key UNIQUE (external_event_id);

-- Add unique constraint on event_id for upsert in sync-odds
ALTER TABLE public.lines
ADD CONSTRAINT lines_event_id_key UNIQUE (event_id);