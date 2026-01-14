-- Create enums
CREATE TYPE public.pool_mode AS ENUM ('capture', 'standard');
CREATE TYPE public.scoring_rule AS ENUM ('straight', 'ats');
CREATE TYPE public.allocation_method AS ENUM ('random', 'draft');
CREATE TYPE public.pool_status AS ENUM ('draft', 'lobby', 'active', 'completed');
CREATE TYPE public.event_type AS ENUM ('game', 'series');
CREATE TYPE public.event_status AS ENUM ('scheduled', 'live', 'final');
CREATE TYPE public.member_role AS ENUM ('creator', 'member');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  venmo_handle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (for admin access)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Pools table
CREATE TABLE public.pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  competition_key TEXT NOT NULL,
  season TEXT NOT NULL,
  mode pool_mode NOT NULL DEFAULT 'standard',
  scoring_rule scoring_rule NOT NULL DEFAULT 'straight',
  status pool_status NOT NULL DEFAULT 'draft',
  buyin_amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  max_players INTEGER DEFAULT 16,
  teams_per_player INTEGER DEFAULT 1,
  allocation_method allocation_method NOT NULL DEFAULT 'random',
  payout_note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

-- Pool members table (supports guests)
CREATE TABLE public.pool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_id UUID,
  display_name TEXT NOT NULL,
  venmo_handle_copy TEXT,
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  claim_token TEXT UNIQUE,
  CONSTRAINT member_identity CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);
ALTER TABLE public.pool_members ENABLE ROW LEVEL SECURITY;

-- Events table (games or series)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_key TEXT NOT NULL,
  external_event_id TEXT,
  event_type event_type NOT NULL DEFAULT 'game',
  round_key TEXT NOT NULL,
  round_order INTEGER NOT NULL DEFAULT 1,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  status event_status NOT NULL DEFAULT 'scheduled',
  final_home_score INTEGER,
  final_away_score INTEGER,
  series_home_wins INTEGER DEFAULT 0,
  series_away_wins INTEGER DEFAULT 0,
  best_of INTEGER DEFAULT 1,
  winner_team_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Lines table (for ATS scoring)
CREATE TABLE public.lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  locked_line_payload JSONB,
  source TEXT NOT NULL DEFAULT 'manual',
  book TEXT,
  locked_at TIMESTAMPTZ
);
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;

-- Pool rounds table
CREATE TABLE public.pool_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE NOT NULL,
  round_key TEXT NOT NULL,
  round_order INTEGER NOT NULL,
  name TEXT NOT NULL
);
ALTER TABLE public.pool_rounds ENABLE ROW LEVEL SECURITY;

-- Pool matchups table
CREATE TABLE public.pool_matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE NOT NULL,
  round_id UUID REFERENCES public.pool_rounds(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  participant_a_member_id UUID REFERENCES public.pool_members(id) ON DELETE SET NULL,
  participant_b_member_id UUID REFERENCES public.pool_members(id) ON DELETE SET NULL,
  winner_member_id UUID REFERENCES public.pool_members(id) ON DELETE SET NULL,
  decided_by scoring_rule,
  decided_at TIMESTAMPTZ,
  commissioner_note TEXT
);
ALTER TABLE public.pool_matchups ENABLE ROW LEVEL SECURITY;

-- Ownership table (for capture mode)
CREATE TABLE public.ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.pool_members(id) ON DELETE CASCADE NOT NULL,
  team_code TEXT NOT NULL,
  acquired_via TEXT NOT NULL DEFAULT 'initial',
  from_matchup_id UUID REFERENCES public.pool_matchups(id) ON DELETE SET NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ownership ENABLE ROW LEVEL SECURITY;

-- Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check pool membership
CREATE OR REPLACE FUNCTION public.is_pool_member(_user_id UUID, _pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pool_members
    WHERE pool_id = _pool_id AND user_id = _user_id
  )
$$;

-- Helper function to check if user is pool creator
CREATE OR REPLACE FUNCTION public.is_pool_creator(_user_id UUID, _pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pools
    WHERE id = _pool_id AND created_by = _user_id
  )
$$;

-- PROFILES RLS
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- USER_ROLES RLS
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- POOLS RLS
CREATE POLICY "Members can view their pools" ON public.pools FOR SELECT TO authenticated 
  USING (public.is_pool_member(auth.uid(), id) OR created_by = auth.uid());
CREATE POLICY "Authenticated users can create pools" ON public.pools FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update their pools" ON public.pools FOR UPDATE TO authenticated 
  USING (created_by = auth.uid());

-- POOL_MEMBERS RLS
CREATE POLICY "Members can view pool members" ON public.pool_members FOR SELECT TO authenticated 
  USING (public.is_pool_member(auth.uid(), pool_id) OR public.is_pool_creator(auth.uid(), pool_id));
CREATE POLICY "Users can join pools" ON public.pool_members FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can update own membership" ON public.pool_members FOR UPDATE TO authenticated 
  USING (user_id = auth.uid());
CREATE POLICY "Creators can manage members" ON public.pool_members FOR UPDATE TO authenticated 
  USING (public.is_pool_creator(auth.uid(), pool_id));

-- EVENTS RLS (public read for now, admin write)
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- LINES RLS
CREATE POLICY "Members can view lines for their pools" ON public.lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Creators can manage lines" ON public.lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Creators can update lines" ON public.lines FOR UPDATE TO authenticated USING (true);

-- POOL_ROUNDS RLS
CREATE POLICY "Members can view rounds" ON public.pool_rounds FOR SELECT TO authenticated 
  USING (public.is_pool_member(auth.uid(), pool_id) OR public.is_pool_creator(auth.uid(), pool_id));
CREATE POLICY "Creators can manage rounds" ON public.pool_rounds FOR ALL TO authenticated 
  USING (public.is_pool_creator(auth.uid(), pool_id));

-- POOL_MATCHUPS RLS
CREATE POLICY "Members can view matchups" ON public.pool_matchups FOR SELECT TO authenticated 
  USING (public.is_pool_member(auth.uid(), pool_id) OR public.is_pool_creator(auth.uid(), pool_id));
CREATE POLICY "Creators can manage matchups" ON public.pool_matchups FOR ALL TO authenticated 
  USING (public.is_pool_creator(auth.uid(), pool_id));

-- OWNERSHIP RLS
CREATE POLICY "Members can view ownership" ON public.ownership FOR SELECT TO authenticated 
  USING (public.is_pool_member(auth.uid(), pool_id) OR public.is_pool_creator(auth.uid(), pool_id));
CREATE POLICY "Creators can manage ownership" ON public.ownership FOR ALL TO authenticated 
  USING (public.is_pool_creator(auth.uid(), pool_id));

-- AUDIT_LOG RLS
CREATE POLICY "Members can view audit log" ON public.audit_log FOR SELECT TO authenticated 
  USING (public.is_pool_member(auth.uid(), pool_id) OR public.is_pool_creator(auth.uid(), pool_id));
CREATE POLICY "System can insert audit log" ON public.audit_log FOR INSERT TO authenticated 
  WITH CHECK (public.is_pool_creator(auth.uid(), pool_id));

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;