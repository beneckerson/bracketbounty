import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Copy, Check, Settings, Loader2, UserPlus, ExternalLink, Rocket, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { ManagePoolDrawer } from '@/components/pool/ManagePoolDrawer';
import { BracketView } from '@/components/bracket/BracketView';
import { MatchupPreview, MatchupPreviewData, groupMatchupsByRound } from '@/components/pool/MatchupPreview';
import { TeamAssignmentDialog } from '@/components/pool/TeamAssignmentDialog';
import { useAuth } from '@/contexts/AuthContext';

// Helper to extract auth loading state
import { supabase } from '@/integrations/supabase/client';
import { getCompetition } from '@/lib/competitions';
import { transformAuditLogs } from '@/lib/audit-utils';
import type { Pool as PoolType, PoolMember as PoolMemberType, Round, Matchup, Team, OwnedTeam, AuditLogEntry } from '@/lib/types';
interface PoolData {
  id: string;
  name: string;
  competition_key: string;
  season: string;
  status: 'draft' | 'lobby' | 'active' | 'completed';
  mode: 'capture' | 'standard';
  scoring_rule: 'straight' | 'ats';
  buyin_amount_cents: number | null;
  max_players: number | null;
  teams_per_player: number | null;
  allocation_method: 'random' | 'draft';
  invite_code: string;
  payout_note: string | null;
  created_by: string | null;
  created_at: string;
  selected_teams: string[] | null;
}

interface PoolMember {
  id: string;
  display_name: string;
  role: 'creator' | 'member';
  is_claimed: boolean;
  user_id: string | null;
  joined_at: string;
}

interface PoolRound {
  id: string;
  round_key: string;
  name: string;
  round_order: number;
}

interface PoolMatchup {
  id: string;
  round_id: string;
  event_id: string | null;
  participant_a_member_id: string | null;
  participant_b_member_id: string | null;
  winner_member_id: string | null;
  decided_by: 'straight' | 'ats' | null;
  commissioner_note: string | null;
}

interface EventData {
  id: string;
  home_team: string;
  away_team: string;
  status: 'scheduled' | 'live' | 'final';
  final_home_score: number | null;
  final_away_score: number | null;
  series_home_wins: number | null;
  series_away_wins: number | null;
  start_time: string | null;
  best_of: number | null;
}

interface TeamData {
  code: string;
  name: string;
  abbreviation: string;
  color: string | null;
}

interface OwnershipData {
  team_code: string;
  member_id: string;
  acquired_via: string;
  from_matchup_id: string | null;
  acquired_at: string;
}

interface LineData {
  event_id: string;
  locked_at: string | null;
  locked_line_payload: {
    home_spread?: number;
    away_spread?: number;
    fetched_at?: string;
  } | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  lobby: 'bg-yellow-500/10 text-yellow-600',
  lobby_full: 'bg-green-500/10 text-green-600',
  active: 'bg-green-500/10 text-green-600',
  completed: 'bg-blue-500/10 text-blue-600',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  lobby: 'Waiting for Players',
  lobby_full: 'Ready to Start',
  active: 'In Progress',
  completed: 'Completed',
};

export default function Pool() {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [pool, setPool] = useState<PoolData | null>(null);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [guestDisplayName, setGuestDisplayName] = useState<string | null>(null);
  
  // Bracket data
  const [bracketPool, setBracketPool] = useState<PoolType | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [oddsLastUpdated, setOddsLastUpdated] = useState<string | null>(null);
  const [loadingBracket, setLoadingBracket] = useState(false);
  
  // Lobby matchup previews
  const [lobbyMatchups, setLobbyMatchups] = useState<MatchupPreviewData[]>([]);
  const [loadingLobbyMatchups, setLoadingLobbyMatchups] = useState(false);
  
  // First-visit assignment reveal
  const [showAssignmentReveal, setShowAssignmentReveal] = useState(false);
  const [assignmentData, setAssignmentData] = useState<Array<{
    member_id: string;
    member_name: string;
    team_code: string;
    team_name: string;
    team_abbreviation: string;
  }>>([]);

  const isCreator = pool?.created_by === user?.id;
  
  // Get claim token for this pool (if guest)
  const claimToken = poolId ? localStorage.getItem(`pool_claim_${poolId}`) : null;

  const fetchPoolData = async () => {
    if (!poolId) return;

    try {
      // First, try to fetch as authenticated user
      if (user) {
        const { data: poolData, error: poolError } = await supabase
          .from('pools')
          .select('*')
          .eq('id', poolId)
          .single();

        if (!poolError && poolData) {
          setPool(poolData);
          setIsGuest(false);

          const { data: membersData } = await supabase
            .from('pool_members')
            .select('id, display_name, role, is_claimed, user_id, joined_at')
            .eq('pool_id', poolId)
            .order('joined_at', { ascending: true });

          setMembers(membersData || []);
          setLoading(false);
          
          // Fetch bracket data if pool is active or completed
          if (poolData.status === 'active' || poolData.status === 'completed') {
            fetchBracketData(poolData, membersData || [], false);
            checkFirstVisitReveal(poolData, membersData || []);
          }
          
          // Fetch lobby matchups for lobby status
          if (poolData.status === 'lobby') {
            fetchLobbyMatchups(poolData);
          }
          return;
        }
      }

      // If no user or RLS blocked, try guest access via claim token
      if (claimToken) {
        const { data: poolData, error: poolError } = await supabase
          .rpc('get_pool_by_id_public', { 
            p_pool_id: poolId, 
            p_claim_token: claimToken 
          });

        if (poolError) {
          console.error('Error fetching pool as guest:', poolError);
          setLoading(false);
          return;
        }

        if (poolData && poolData.length > 0) {
          setPool(poolData[0] as PoolData);
          setIsGuest(true);

          // Get members via public function
          const { data: membersData } = await supabase
            .rpc('get_pool_members_public', { 
              p_pool_id: poolId, 
              p_claim_token: claimToken 
            });

          setMembers((membersData || []) as PoolMember[]);

          // Get guest's display name
          const { data: guestData } = await supabase
            .rpc('get_pool_for_guest', { p_claim_token: claimToken });
          
          if (guestData && guestData.length > 0) {
            setGuestDisplayName(guestData[0].display_name);
          }
          
          // Fetch bracket data for active/completed pools
          const pd = poolData[0] as PoolData;
          if (pd.status === 'active' || pd.status === 'completed') {
            fetchBracketData(pd, (membersData || []) as PoolMember[], true);
            checkFirstVisitReveal(pd, (membersData || []) as PoolMember[]);
          }
          
          // Fetch lobby matchups for lobby status
          if (pd.status === 'lobby') {
            fetchLobbyMatchups(pd);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching pool:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBracketData = async (poolData: PoolData, membersData: PoolMember[], isGuestUser: boolean) => {
    if (!poolId) return;
    setLoadingBracket(true);

    try {
      let rounds: PoolRound[] = [];
      let matchups: PoolMatchup[] = [];
      let ownership: OwnershipData[] = [];
      let rawAuditLogs: any[] = [];

      // If guest, use the SECURITY DEFINER function to bypass RLS
      if (isGuestUser && claimToken) {
        const { data: bracketData, error: bracketError } = await supabase
          .rpc('get_bracket_data_public', { 
            p_pool_id: poolId, 
            p_claim_token: claimToken 
          });

        if (bracketError) {
          console.error('Error fetching bracket data as guest:', bracketError);
          throw bracketError;
        }
        
        // Parse the JSON response
        const parsedData = bracketData as unknown as {
          rounds: PoolRound[];
          matchups: PoolMatchup[];
          ownership: OwnershipData[];
          audit_log: any[];
        } | null;
        
        rounds = parsedData?.rounds || [];
        matchups = parsedData?.matchups || [];
        ownership = parsedData?.ownership || [];
        rawAuditLogs = parsedData?.audit_log || [];
      } else {
        // Authenticated user - use direct queries
        const [roundsRes, matchupsRes, ownershipRes, auditRes] = await Promise.all([
          supabase
            .from('pool_rounds')
            .select('*')
            .eq('pool_id', poolId)
            .order('round_order', { ascending: true }),
          supabase
            .from('pool_matchups')
            .select('*')
            .eq('pool_id', poolId),
          supabase
            .from('ownership')
            .select('team_code, member_id, acquired_via, from_matchup_id, acquired_at')
            .eq('pool_id', poolId),
          supabase
            .from('audit_log')
            .select('*')
            .eq('pool_id', poolId)
            .order('created_at', { ascending: false })
        ]);

        rounds = (roundsRes.data || []) as PoolRound[];
        matchups = (matchupsRes.data || []) as PoolMatchup[];
        ownership = (ownershipRes.data || []) as OwnershipData[];
        rawAuditLogs = auditRes.data || [];
      }

      // Get event IDs from matchups
      const eventIds = matchups
        .map(m => m.event_id)
        .filter((id): id is string => id !== null);

      // Fetch events (now publicly accessible)
      let events: EventData[] = [];
      if (eventIds.length > 0) {
        const { data: eventsData } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds);
        events = (eventsData || []) as EventData[];
      }

      // Fetch lines for spreads (now publicly accessible)
      let lines: LineData[] = [];
      if (eventIds.length > 0) {
        const { data: linesData } = await supabase
          .from('lines')
          .select('event_id, locked_at, locked_line_payload')
          .in('event_id', eventIds);
        lines = (linesData || []) as LineData[];
      }

      // Get team codes from events
      const teamCodes = new Set<string>();
      events.forEach(e => {
        teamCodes.add(e.home_team);
        teamCodes.add(e.away_team);
      });

      // Fetch teams (now publicly accessible)
      let teams: TeamData[] = [];
      if (teamCodes.size > 0) {
        const { data: teamsData } = await supabase
          .from('teams')
          .select('code, name, abbreviation, color')
          .in('code', Array.from(teamCodes));
        teams = (teamsData || []) as TeamData[];
      }

      // Build lookup maps
      const teamMap: Record<string, TeamData> = {};
      teams.forEach(t => { teamMap[t.code] = t; });

      const eventMap: Record<string, EventData> = {};
      events.forEach(e => { eventMap[e.id] = e; });

      const lineMap: Record<string, LineData> = {};
      let mostRecentOddsUpdate: string | null = null;
      lines.forEach(l => { 
        lineMap[l.event_id] = l;
        // Track the most recent timestamp: prefer locked_at, fallback to fetched_at
        const lineTimestamp = l.locked_at || l.locked_line_payload?.fetched_at || null;
        if (lineTimestamp && (!mostRecentOddsUpdate || lineTimestamp > mostRecentOddsUpdate)) {
          mostRecentOddsUpdate = lineTimestamp;
        }
      });

      const ownershipByTeam: Record<string, OwnershipData> = {};
      const ownershipByMember: Record<string, OwnershipData[]> = {};
      ownership.forEach(o => {
        ownershipByTeam[o.team_code] = o;
        if (!ownershipByMember[o.member_id]) {
          ownershipByMember[o.member_id] = [];
        }
        ownershipByMember[o.member_id].push(o);
      });

      // Build Pool type structure
      const transformedRounds: Round[] = rounds.map(r => {
        const roundMatchups = matchups.filter(m => m.round_id === r.id);
        
        const transformedMatchups: Matchup[] = roundMatchups.map(m => {
          const event = m.event_id ? eventMap[m.event_id] : null;
          const line = m.event_id ? lineMap[m.event_id] : null;
          
          const homeTeamCode = event?.home_team || '';
          const awayTeamCode = event?.away_team || '';
          
          const homeTeamData = teamMap[homeTeamCode];
          const awayTeamData = teamMap[awayTeamCode];
          
          const homeOwnership = ownershipByTeam[homeTeamCode];
          const awayOwnership = ownershipByTeam[awayTeamCode];

          const teamA: Team = {
            code: homeTeamCode,
            name: homeTeamData?.name || homeTeamCode,
            abbreviation: homeTeamData?.abbreviation || homeTeamCode.substring(0, 3).toUpperCase(),
            seed: 0,
            color: homeTeamData?.color || '#888888',
          };

          const teamB: Team = {
            code: awayTeamCode,
            name: awayTeamData?.name || awayTeamCode,
            abbreviation: awayTeamData?.abbreviation || awayTeamCode.substring(0, 3).toUpperCase(),
            seed: 0,
            color: awayTeamData?.color || '#888888',
          };

          // Determine status
          let status: 'upcoming' | 'live' | 'final' = 'upcoming';
          if (event?.status === 'final') status = 'final';
          else if (event?.status === 'live') status = 'live';

          return {
            id: m.id,
            roundId: r.id,
            eventId: m.event_id || '',
            teamA: {
              team: teamA,
              // For final matchups, use historical participant IDs (preserved even after elimination)
              ownerId: status === 'final' 
                ? (m.participant_a_member_id || homeOwnership?.member_id || '')
                : (homeOwnership?.member_id || ''),
              score: event?.final_home_score ?? undefined,
              seriesWins: event?.series_home_wins ?? undefined,
              spread: line?.locked_line_payload?.home_spread ?? undefined,
            },
            teamB: {
              team: teamB,
              // For final matchups, use historical participant IDs (preserved even after elimination)
              ownerId: status === 'final' 
                ? (m.participant_b_member_id || awayOwnership?.member_id || '')
                : (awayOwnership?.member_id || ''),
              score: event?.final_away_score ?? undefined,
              seriesWins: event?.series_away_wins ?? undefined,
              spread: line?.locked_line_payload?.away_spread ?? undefined,
            },
            status,
            winnerId: m.winner_member_id || undefined,
            winnerTeamCode: undefined,
            decidedBy: m.decided_by || undefined,
            commissionerNote: m.commissioner_note || undefined,
            startTime: event?.start_time ? new Date(event.start_time) : undefined,
            bestOf: event?.best_of ?? undefined,
          };
        });

        return {
          id: r.id,
          key: r.round_key,
          name: r.name,
          order: r.round_order,
          matchups: transformedMatchups,
        };
      });

      // Build pool members with owned teams
      const transformedMembers: PoolMemberType[] = membersData.map(m => {
        const memberOwnership = ownershipByMember[m.id] || [];
        const ownedTeams: OwnedTeam[] = memberOwnership.map(o => ({
          teamCode: o.team_code,
          acquiredVia: o.acquired_via as 'initial' | 'capture',
          fromMatchupId: o.from_matchup_id || undefined,
          acquiredAt: new Date(o.acquired_at),
        }));

        return {
          id: m.id,
          participant: {
            id: m.user_id || m.id,
            displayName: m.display_name,
            initials: m.display_name.substring(0, 2).toUpperCase(),
            isClaimed: m.is_claimed,
          },
          role: m.role,
          ownedTeams,
        };
      });

      const fullPool: PoolType = {
        id: poolData.id,
        name: poolData.name,
        competitionKey: poolData.competition_key,
        season: poolData.season,
        mode: poolData.mode,
        scoringRule: poolData.scoring_rule,
        status: poolData.status,
        buyinAmountCents: poolData.buyin_amount_cents || 0,
        currency: 'USD',
        maxPlayers: poolData.max_players || 16,
        teamsPerPlayer: poolData.teams_per_player || 2,
        allocationMethod: poolData.allocation_method,
        inviteCode: poolData.invite_code,
        createdBy: poolData.created_by || '',
        members: transformedMembers,
        rounds: transformedRounds,
      };

      setBracketPool(fullPool);

      // Build member name map for readable descriptions
      const memberNameMap: Record<string, string> = {};
      membersData.forEach(m => {
        memberNameMap[m.id] = m.display_name;
        if (m.user_id) {
          memberNameMap[m.user_id] = m.display_name;
        }
      });

      // Transform raw logs to AuditLogEntry format
      const transformedLogs = transformAuditLogs(rawAuditLogs || [], memberNameMap);
      setAuditLogs(transformedLogs);
      
      // Set odds last updated from most recent line timestamp
      setOddsLastUpdated(mostRecentOddsUpdate);
    } catch (error) {
      console.error('Error fetching bracket data:', error);
    } finally {
      setLoadingBracket(false);
    }
  };

  // Fetch matchup previews for lobby view
  const fetchLobbyMatchups = async (poolData: PoolData) => {
    if (!poolId || poolData.status !== 'lobby') return;
    setLoadingLobbyMatchups(true);

    try {
      const selectedTeams: string[] = poolData.selected_teams || [];
      if (selectedTeams.length === 0) {
        setLoadingLobbyMatchups(false);
        return;
      }

      // Fetch events for this competition with selected teams
      const { data: events } = await supabase
        .from('events')
        .select('id, home_team, away_team, start_time, round_key')
        .eq('competition_key', poolData.competition_key)
        .in('home_team', selectedTeams)
        .in('away_team', selectedTeams)
        .order('start_time', { ascending: true });

      if (!events || events.length === 0) {
        setLoadingLobbyMatchups(false);
        return;
      }

      // Fetch teams data
      const teamCodes = new Set<string>();
      events.forEach(e => {
        teamCodes.add(e.home_team);
        teamCodes.add(e.away_team);
      });

      const { data: teamsData } = await supabase
        .from('teams')
        .select('code, name, abbreviation, color')
        .in('code', Array.from(teamCodes));

      // Fetch roster data for seeds
      const { data: rosterData } = await supabase
        .from('competition_rosters')
        .select('team_code, seed')
        .eq('competition_key', poolData.competition_key)
        .eq('season', poolData.season)
        .in('team_code', Array.from(teamCodes));

      // Build team map
      const teamMap: Record<string, Team> = {};
      (teamsData || []).forEach(t => {
        const roster = (rosterData || []).find(r => r.team_code === t.code);
        teamMap[t.code] = {
          code: t.code,
          name: t.name,
          abbreviation: t.abbreviation,
          seed: roster?.seed || 0,
          color: t.color || '#888888',
        };
      });

      // Build matchup previews
      const previews: MatchupPreviewData[] = events.map(e => ({
        id: e.id,
        awayTeam: teamMap[e.away_team] || { code: e.away_team, name: e.away_team, abbreviation: e.away_team.substring(0, 3).toUpperCase(), seed: 0, color: '#888888' },
        homeTeam: teamMap[e.home_team] || { code: e.home_team, name: e.home_team, abbreviation: e.home_team.substring(0, 3).toUpperCase(), seed: 0, color: '#888888' },
        startTime: e.start_time ? new Date(e.start_time) : null,
        roundKey: e.round_key,
      }));

      setLobbyMatchups(previews);
    } catch (error) {
      console.error('Error fetching lobby matchups:', error);
    } finally {
      setLoadingLobbyMatchups(false);
    }
  };

  // Check and prepare first-visit assignment reveal
  const checkFirstVisitReveal = async (poolData: PoolData, membersData: PoolMember[]) => {
    if (!poolId || poolData.status !== 'active') return;
    
    const seenKey = `assignments_seen_${poolId}`;
    const hasSeen = localStorage.getItem(seenKey);
    
    if (hasSeen) return;

    try {
      // Fetch ownership data
      const { data: ownership } = await supabase
        .from('ownership')
        .select('team_code, member_id')
        .eq('pool_id', poolId);

      if (!ownership || ownership.length === 0) return;

      // Fetch teams data
      const teamCodes = ownership.map(o => o.team_code);
      const { data: teamsData } = await supabase
        .from('teams')
        .select('code, name, abbreviation')
        .in('code', teamCodes);

      const teamMap: Record<string, { name: string; abbreviation: string }> = {};
      (teamsData || []).forEach(t => {
        teamMap[t.code] = { name: t.name, abbreviation: t.abbreviation };
      });

      // Build member name map
      const memberMap: Record<string, string> = {};
      membersData.forEach(m => {
        memberMap[m.id] = m.display_name;
      });

      // Build assignments
      const assignments = ownership.map(o => ({
        member_id: o.member_id,
        member_name: memberMap[o.member_id] || 'Unknown',
        team_code: o.team_code,
        team_name: teamMap[o.team_code]?.name || o.team_code,
        team_abbreviation: teamMap[o.team_code]?.abbreviation || o.team_code.substring(0, 3).toUpperCase(),
      }));

      setAssignmentData(assignments);
      setShowAssignmentReveal(true);
    } catch (error) {
      console.error('Error preparing assignment reveal:', error);
    }
  };

  const handleAssignmentRevealClose = () => {
    if (poolId) {
      localStorage.setItem(`assignments_seen_${poolId}`, 'true');
    }
    setShowAssignmentReveal(false);
  };

  useEffect(() => {
    fetchPoolData();
  }, [poolId, user]);

  const copyInviteCode = () => {
    if (pool) {
      navigator.clipboard.writeText(pool.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyShareLink = () => {
    if (pool) {
      const shareUrl = `${window.location.origin}/join/${pool.invite_code}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Determine if pool is full for status display
  const isFull = pool ? (pool.max_players && members.length >= pool.max_players) : false;
  const displayStatus = pool?.status === 'lobby' && isFull ? 'lobby_full' : pool?.status;

  // Show loading while auth or pool data is being fetched
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="text-center pt-32">
          <h1 className="text-2xl font-display text-foreground mb-2">Pool Not Found</h1>
          <p className="text-muted-foreground mb-6">This pool doesn't exist or you don't have access.</p>
          <Button asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const competition = getCompetition(pool.competition_key);
  const buyinDisplay = pool.buyin_amount_cents && pool.buyin_amount_cents > 0
    ? `$${(pool.buyin_amount_cents / 100).toFixed(0)}`
    : 'Free';

  // Show loading while bracket data is being fetched for active/completed pools
  if ((pool.status === 'active' || pool.status === 'completed') && !bracketPool) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Show bracket view for active/completed pools
  if ((pool.status === 'active' || pool.status === 'completed') && bracketPool) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20">
          <BracketView pool={bracketPool} auditLogs={auditLogs} oddsLastUpdated={oddsLastUpdated} />
        </main>
        
        {/* First-visit assignment reveal dialog */}
        <TeamAssignmentDialog
          open={showAssignmentReveal}
          onOpenChange={(open) => {
            if (!open) handleAssignmentRevealClose();
          }}
          assignments={assignmentData}
          onViewBracket={handleAssignmentRevealClose}
          showShuffleAnimation={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Back Link */}
          <Link 
            to={user ? "/my-pools" : "/"} 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {user ? 'Back to My Pools' : 'Back to Home'}
          </Link>

          {/* Guest Banner */}
          {isGuest && !user && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    You're viewing as: <span className="text-primary">{guestDisplayName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a free account to track multiple pools and get notifications.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/auth')}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </Button>
              </div>
            </div>
          )}

          {/* Pool Header */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{competition?.icon || '🏆'}</span>
                <div>
                  <h1 className="text-2xl font-bebas text-foreground tracking-wide">{pool.name}</h1>
                  <p className="text-muted-foreground">
                    {competition?.name || pool.competition_key} • {pool.season}
                  </p>
                </div>
              </div>
              <Badge className={statusColors[displayStatus || 'draft']}>
                {statusLabels[displayStatus || 'draft']}
              </Badge>
            </div>

            {/* Pool Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Mode</p>
                <p className="font-medium capitalize">{pool.mode}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Scoring</p>
                <p className="font-medium">{pool.scoring_rule === 'ats' ? 'ATS' : 'Straight'}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Buy-in</p>
                <p className="font-medium">{buyinDisplay}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Allocation</p>
                <p className="font-medium capitalize">{pool.allocation_method}</p>
              </div>
            </div>

            {/* Commissioner Ready Prompt */}
            {isCreator && pool.status === 'lobby' && isFull && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
                <Rocket className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-600 mb-1">All players have joined!</p>
                  <p className="text-xs text-muted-foreground">
                    Click "Start Pool Setup" to sync games and start the competition.
                  </p>
                </div>
                <Button size="sm" onClick={() => setManageOpen(true)} className="bg-green-600 hover:bg-green-700">
                  Start Pool Setup
                </Button>
              </div>
            )}

            {/* Invite Link (for lobby status) */}
            {pool.status === 'lobby' && (
              <div className="flex flex-col gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Invite Friends</p>
                  <p className="text-xs text-muted-foreground">Share this link with friends to join your pool</p>
                </div>
                
                {/* Primary: Share Link */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-background px-3 py-2 rounded-lg">
                    <code className="flex-1 text-sm font-mono truncate">
                      {window.location.origin}/join/{pool.invite_code}
                    </code>
                    <Button size="sm" onClick={copyShareLink} className="gap-1.5 shrink-0">
                      {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedLink ? 'Copied!' : 'Copy Link'}
                    </Button>
                  </div>
                </div>

                {/* Secondary: Code */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Or share code:</span>
                  <code className="font-mono font-bold tracking-widest">{pool.invite_code}</code>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyInviteCode} title="Copy code">
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Payout Note */}
            {pool.payout_note && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Payout Structure</p>
                <p className="text-sm">{pool.payout_note}</p>
              </div>
            )}
          </div>

          {/* Matchups Preview Section (for lobby) */}
          {pool.status === 'lobby' && (
            <div className="bg-card border border-border rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg text-foreground">
                  Upcoming Matchups
                </h2>
                {loadingLobbyMatchups && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />
                )}
              </div>
              
              {lobbyMatchups.length > 0 ? (
                <div className="space-y-2">
                  {lobbyMatchups.slice(0, 6).map((matchup) => (
                    <MatchupPreview key={matchup.id} matchup={matchup} />
                  ))}
                  {lobbyMatchups.length > 6 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{lobbyMatchups.length - 6} more matchups
                    </p>
                  )}
                </div>
              ) : !loadingLobbyMatchups ? (
                <p className="text-sm text-muted-foreground">
                  Matchups will appear once games are scheduled for this competition.
                </p>
              ) : null}
            </div>
          )}

          {/* Members Section */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-foreground flex items-center gap-2">
                <Users className="h-5 w-5" />
                Players ({members.length} / {pool.max_players || '—'})
              </h2>
              {isCreator && pool.status === 'lobby' && (
                <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {member.display_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{member.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.role === 'creator' && (
                      <Badge variant="outline" className="text-xs">Commissioner</Badge>
                    )}
                    {!member.is_claimed && (
                      <Badge variant="secondary" className="text-xs">Guest</Badge>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {pool.max_players && members.length < pool.max_players && (
                Array.from({ length: Math.min(pool.max_players - members.length, 3) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center p-3 border border-dashed border-border rounded-lg text-muted-foreground"
                  >
                    <div className="w-8 h-8 rounded-full border border-dashed border-border mr-3" />
                    <span className="text-sm">Waiting for player...</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Loading bracket indicator */}
          {(pool.status === 'active' || pool.status === 'completed') && loadingBracket && (
            <div className="bg-card border border-border rounded-2xl p-6 mt-6">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Loading bracket...</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Manage Pool Drawer */}
      {pool && isCreator && (
        <ManagePoolDrawer
          open={manageOpen}
          onOpenChange={setManageOpen}
          pool={pool}
          members={members}
          onMembersChange={fetchPoolData}
          onPoolDelete={() => navigate('/my-pools')}
        />
      )}
    </div>
  );
}
