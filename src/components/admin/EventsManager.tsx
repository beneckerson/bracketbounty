import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar, RefreshCw, Loader2, Save, AlertCircle, CheckCircle, Plus, ChevronsUpDown, Check, Pencil, Trash2, Settings2, Undo2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RosterTeam {
  code: string;
  name: string;
}

interface Event {
  id: string;
  external_event_id: string | null;
  competition_key: string;
  round_key: string;
  round_order: number;
  home_team: string;
  away_team: string;
  start_time: string | null;
  status: 'scheduled' | 'live' | 'final';
  event_type: 'game' | 'series';
  final_home_score: number | null;
  final_away_score: number | null;
  // Pool aggregation
  affected_pools: string[];
  pending_matchup_count: number;
}

interface EventsManagerProps {
  competitionKey: string;
}

// Round options for NFL playoffs
const NFL_ROUNDS = [
  { key: 'wild_card', name: 'Wild Card', order: 1 },
  { key: 'divisional', name: 'Divisional', order: 2 },
  { key: 'conference', name: 'Conference Championship', order: 3 },
  { key: 'super_bowl', name: 'Super Bowl', order: 4 },
];

// Round options for College Football Playoff
const CFP_ROUNDS = [
  { key: 'first_round', name: 'First Round', order: 1 },
  { key: 'quarterfinals', name: 'Quarterfinals', order: 2 },
  { key: 'semifinals', name: 'Semifinals', order: 3 },
  { key: 'championship', name: 'Championship', order: 4 },
];

// Round options for NBA/NHL playoffs
const SERIES_ROUNDS = [
  { key: 'first_round', name: 'First Round', order: 1 },
  { key: 'second_round', name: 'Second Round', order: 2 },
  { key: 'conference_finals', name: 'Conference Finals', order: 3 },
  { key: 'finals', name: 'Finals', order: 4 },
];

// Round options for MLB playoffs
const MLB_ROUNDS = [
  { key: 'wild_card', name: 'Wild Card', order: 1 },
  { key: 'division_series', name: 'Division Series', order: 2 },
  { key: 'lcs', name: 'League Championship', order: 3 },
  { key: 'world_series', name: 'World Series', order: 4 },
];

// Round options for NCAA Tournament (March Madness)
const MARCH_MADNESS_ROUNDS = [
  { key: 'round_of_64', name: 'Round of 64', order: 1 },
  { key: 'round_of_32', name: 'Round of 32', order: 2 },
  { key: 'sweet_sixteen', name: 'Sweet Sixteen', order: 3 },
  { key: 'elite_eight', name: 'Elite Eight', order: 4 },
  { key: 'final_four', name: 'Final Four', order: 5 },
  { key: 'championship', name: 'Championship', order: 6 },
];

function getRoundsForCompetition(competitionKey: string) {
  switch (competitionKey) {
    case 'cfp':
      return CFP_ROUNDS;
    case 'nfl_playoffs':
      return NFL_ROUNDS;
    case 'mlb_playoffs':
      return MLB_ROUNDS;
    case 'march_madness':
      return MARCH_MADNESS_ROUNDS;
    case 'nba_playoffs':
    case 'nhl_playoffs':
    default:
      return SERIES_ROUNDS;
  }
}

function getRoundName(roundKey: string | undefined): string {
  if (!roundKey) return '-';
  const roundNames: Record<string, string> = {
    wild_card: 'Wild Card',
    divisional: 'Divisional',
    conference: 'Conference Championship',
    super_bowl: 'Super Bowl',
    first_round: 'First Round',
    quarterfinals: 'Quarterfinals',
    semifinals: 'Semifinals',
    championship: 'Championship',
    second_round: 'Conference Semifinals',
    conference_finals: 'Conference Finals',
    finals: 'Finals',
    division_series: 'Division Series',
    lcs: 'League Championship',
    world_series: 'World Series',
    
    round_of_64: 'Round of 64',
    round_of_32: 'Round of 32',
    sweet_sixteen: 'Sweet Sixteen',
    elite_eight: 'Elite Eight',
    final_four: 'Final Four',
  };
  return roundNames[roundKey] || roundKey;
}

export function EventsManager({ competitionKey }: EventsManagerProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, { round_key: string; round_order: number }>>({});

  // Resolution dialog state
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [commissionerNote, setCommissionerNote] = useState('');
  const [resolving, setResolving] = useState(false);

  // Create event dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createHomeTeam, setCreateHomeTeam] = useState('');
  const [createAwayTeam, setCreateAwayTeam] = useState('');
  const [createRoundKey, setCreateRoundKey] = useState('round_of_64');
  const [createStartTime, setCreateStartTime] = useState('');
  
  const [creating, setCreating] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const [awayOpen, setAwayOpen] = useState(false);
  const [rosterTeams, setRosterTeams] = useState<RosterTeam[]>([]);
  const [homeSearch, setHomeSearch] = useState('');
  const [awaySearch, setAwaySearch] = useState('');

  // Edit event dialog state
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [editHomeTeam, setEditHomeTeam] = useState('');
  const [editAwayTeam, setEditAwayTeam] = useState('');
  const [editRoundKey, setEditRoundKey] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editHomeOpen, setEditHomeOpen] = useState(false);
  const [editAwayOpen, setEditAwayOpen] = useState(false);
  const [editHomeSearch, setEditHomeSearch] = useState('');
  const [editAwaySearch, setEditAwaySearch] = useState('');

  // Delete confirmation state
  const [deleteEvent, setDeleteEvent] = useState<Event | null>(null);
  const [deleteMatchupCount, setDeleteMatchupCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // Spread override state
  const [spreadEvent, setSpreadEvent] = useState<Event | null>(null);
  const [spreadHome, setSpreadHome] = useState('');
  const [spreadAway, setSpreadAway] = useState('');
  const [spreadSaving, setSpreadSaving] = useState(false);

  // Un-resolve state
  const [unresolveEvent, setUnresolveEvent] = useState<Event | null>(null);
  const [unresolving, setUnresolving] = useState(false);

  // Fetch roster teams when create or edit dialog opens
  const isMarchMadness = competitionKey === 'march_madness';
  
  useEffect(() => {
    if (!showCreateDialog && !editEvent && !isMarchMadness) return;
    (async () => {
      const { data: season } = await supabase
        .from('competition_seasons')
        .select('season')
        .eq('competition_key', competitionKey)
        .eq('is_active', true)
        .maybeSingle();
      if (!season) return;
      const { data: roster } = await supabase
        .from('competition_rosters')
        .select('team_code')
        .eq('competition_key', competitionKey)
        .eq('season', season.season);
      if (!roster?.length) return;
      const codes = roster.map(r => r.team_code);
      const { data: teams } = await supabase
        .from('teams')
        .select('code, name')
        .in('code', codes);
      setRosterTeams((teams || []).sort((a, b) => a.name.localeCompare(b.name)));
    })();
  }, [showCreateDialog, editEvent, competitionKey, isMarchMadness]);

  const rounds = getRoundsForCompetition(competitionKey);

  useEffect(() => {
    fetchEvents();
  }, [competitionKey]);

  async function fetchEvents() {
    setLoading(true);
    
    // First fetch all events for this competition
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('competition_key', competitionKey)
      .order('round_order', { ascending: true })
      .order('start_time', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      toast.error('Failed to load events');
      setLoading(false);
      return;
    }

    if (!eventsData || eventsData.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    // Then fetch pool matchups to calculate affected pools
    const { data: matchups, error: matchupsError } = await supabase
      .from('pool_matchups')
      .select(`
        id,
        event_id,
        winner_member_id,
        pool:pools!inner(id, name, competition_key, status)
      `)
      .eq('pools.competition_key', competitionKey)
      .eq('pools.status', 'active');

    if (matchupsError) {
      console.error('Error fetching matchups:', matchupsError);
    }

    // Merge events with pool matchup data
    const enrichedEvents: Event[] = eventsData.map(event => {
      const eventMatchups = (matchups || []).filter(m => m.event_id === event.id);
      const pendingMatchups = eventMatchups.filter(m => !m.winner_member_id);
      const affectedPools = [...new Set(pendingMatchups.map(m => m.pool?.name).filter(Boolean))] as string[];

      return {
        ...event,
        affected_pools: affectedPools,
        pending_matchup_count: pendingMatchups.length,
      };
    });

    setEvents(enrichedEvents);
    setLoading(false);
  }

  async function handleSyncOdds() {
    setSyncing(true);
    try {
      const response = await supabase.functions.invoke('sync-odds', {
        body: { competition_key: competitionKey },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      toast.success(`Synced ${result.events_synced} events and ${result.lines_synced} lines`);
      
      // Refresh the events list
      await fetchEvents();
    } catch (error: any) {
      console.error('Error syncing odds:', error);
      toast.error(error.message || 'Failed to sync odds');
    }
    setSyncing(false);
  }

  function handleRoundChange(eventId: string, roundKey: string) {
    const round = rounds.find(r => r.key === roundKey);
    if (!round) return;

    setPendingChanges(prev => ({
      ...prev,
      [eventId]: { round_key: roundKey, round_order: round.order }
    }));
  }

  async function handleSaveChanges() {
    if (Object.keys(pendingChanges).length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      // Update each event with pending changes
      for (const [eventId, changes] of Object.entries(pendingChanges)) {
        const { error } = await supabase
          .from('events')
          .update({
            round_key: changes.round_key,
            round_order: changes.round_order,
          })
          .eq('id', eventId);

        if (error) {
          console.error('Error updating event:', error);
          throw new Error(`Failed to update event: ${error.message}`);
        }

        // Cascade: update pool_matchups that reference this event
        const { data: matchupsForEvent } = await supabase
          .from('pool_matchups')
          .select('id, pool_id')
          .eq('event_id', eventId);

        if (matchupsForEvent && matchupsForEvent.length > 0) {
          // Group by pool_id to look up the correct pool_round once per pool
          const poolIds = [...new Set(matchupsForEvent.map(m => m.pool_id))];
          
          for (const poolId of poolIds) {
            // Find the pool_round matching the new round_key
            const { data: poolRound } = await supabase
              .from('pool_rounds')
              .select('id')
              .eq('pool_id', poolId)
              .eq('round_key', changes.round_key)
              .maybeSingle();

            if (poolRound) {
              const matchupIds = matchupsForEvent
                .filter(m => m.pool_id === poolId)
                .map(m => m.id);

              const { error: updateError } = await supabase
                .from('pool_matchups')
                .update({ round_id: poolRound.id })
                .in('id', matchupIds);

              if (updateError) {
                console.error('Error cascading round to matchups:', updateError);
              }
            }
          }
        }
      }

      toast.success(`Updated ${Object.keys(pendingChanges).length} event(s)`);
      setPendingChanges({});
      await fetchEvents();
    } catch (error: any) {
      console.error('Error saving changes:', error);
      toast.error(error.message || 'Failed to save changes');
    }
    setSaving(false);
  }

  function openResolveDialog(event: Event) {
    setSelectedEvent(event);
    setHomeScore(event.final_home_score?.toString() || '');
    setAwayScore(event.final_away_score?.toString() || '');
    setCommissionerNote('');
  }

  async function handleResolve() {
    if (!selectedEvent) return;

    const home = parseInt(homeScore);
    const away = parseInt(awayScore);

    if (isNaN(home) || isNaN(away)) {
      toast.error('Please enter valid scores');
      return;
    }

    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('resolve-event', {
        body: {
          event_id: selectedEvent.id,
          home_score: home,
          away_score: away,
          commissioner_note: commissionerNote || undefined,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Resolved ${data.resolved_count} matchups for ${data.away_team} @ ${data.home_team}`);
        setSelectedEvent(null);
        fetchEvents();
      } else {
        throw new Error(data.error || 'Failed to resolve event');
      }
    } catch (error: any) {
      console.error('Error resolving event:', error);
      toast.error(error.message || 'Failed to resolve event');
    }
    setResolving(false);
  }

  async function handleCreateEvent() {
    if (!createHomeTeam.trim() || !createAwayTeam.trim()) {
      toast.error('Please enter both team codes');
      return;
    }

    const round = rounds.find(r => r.key === createRoundKey);
    if (!round) return;

    setCreating(true);
    try {
      const homeCode = createHomeTeam.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      const awayCode = createAwayTeam.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

      // Insert event with NO external_event_id (manual marker)
      const { data: newEvent, error } = await supabase
        .from('events')
        .insert({
          competition_key: competitionKey,
          round_key: createRoundKey,
          round_order: round.order,
          home_team: homeCode,
          away_team: awayCode,
          start_time: createStartTime || null,
          event_type: 'game' as const,
          status: 'scheduled' as const,
        })
        .select()
        .single();

      if (error) throw error;

      // Also upsert both teams into the teams table
      // Use shared helpers for proper abbreviations and colors
      const { deriveSchoolAbbreviation, hashToColor } = await import('@/lib/team-utils');
      await supabase.from('teams').upsert([
        { code: homeCode, name: createHomeTeam.trim(), abbreviation: deriveSchoolAbbreviation(createHomeTeam.trim()), league: 'NCAAB', color: hashToColor(homeCode) },
        { code: awayCode, name: createAwayTeam.trim(), abbreviation: deriveSchoolAbbreviation(createAwayTeam.trim()), league: 'NCAAB', color: hashToColor(awayCode) },
      ], { onConflict: 'code', ignoreDuplicates: true });

      toast.success(`Created event: ${awayCode} @ ${homeCode}`);
      setShowCreateDialog(false);
      setCreateHomeTeam('');
      setCreateAwayTeam('');
      setCreateRoundKey('round_of_64');
      setCreateStartTime('');
      
      await fetchEvents();
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error(error.message || 'Failed to create event');
    }
    setCreating(false);
  }

  function openEditDialog(event: Event) {
    setEditEvent(event);
    // Try to find the team name from roster, fall back to code
    const homeName = rosterTeams.find(t => t.code === event.home_team)?.name || event.home_team;
    const awayName = rosterTeams.find(t => t.code === event.away_team)?.name || event.away_team;
    setEditHomeTeam(homeName);
    setEditAwayTeam(awayName);
    setEditRoundKey(event.round_key);
    setEditStartTime(event.start_time ? new Date(event.start_time).toISOString().slice(0, 16) : '');
  }

  async function handleEditSave() {
    if (!editEvent || !editHomeTeam.trim() || !editAwayTeam.trim()) return;
    const round = rounds.find(r => r.key === editRoundKey);
    if (!round) return;

    setEditSaving(true);
    try {
      const homeCode = editHomeTeam.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      const awayCode = editAwayTeam.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

      const { error } = await supabase
        .from('events')
        .update({
          home_team: homeCode,
          away_team: awayCode,
          round_key: editRoundKey,
          round_order: round.order,
          start_time: editStartTime || null,
        })
        .eq('id', editEvent.id);

      if (error) throw error;

      // Cascade round change to pool_matchups
      if (editRoundKey !== editEvent.round_key) {
        const { data: matchupsForEvent } = await supabase
          .from('pool_matchups')
          .select('id, pool_id')
          .eq('event_id', editEvent.id);

        if (matchupsForEvent && matchupsForEvent.length > 0) {
          const poolIds = [...new Set(matchupsForEvent.map(m => m.pool_id))];
          for (const poolId of poolIds) {
            const { data: poolRound } = await supabase
              .from('pool_rounds')
              .select('id')
              .eq('pool_id', poolId)
              .eq('round_key', editRoundKey)
              .maybeSingle();

            if (poolRound) {
              const matchupIds = matchupsForEvent
                .filter(m => m.pool_id === poolId)
                .map(m => m.id);
              await supabase
                .from('pool_matchups')
                .update({ round_id: poolRound.id })
                .in('id', matchupIds);
            }
          }
        }
      }

      // Upsert teams with proper abbreviations
      const { deriveSchoolAbbreviation: deriveAbbr, hashToColor: hashColor } = await import('@/lib/team-utils');
      await supabase.from('teams').upsert([
        { code: homeCode, name: editHomeTeam.trim(), abbreviation: deriveAbbr(editHomeTeam.trim()), league: 'NCAAB', color: hashColor(homeCode) },
        { code: awayCode, name: editAwayTeam.trim(), abbreviation: deriveAbbr(editAwayTeam.trim()), league: 'NCAAB', color: hashColor(awayCode) },
      ], { onConflict: 'code', ignoreDuplicates: true });

      toast.success(`Updated event: ${awayCode} @ ${homeCode}`);
      setEditEvent(null);
      await fetchEvents();
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast.error(error.message || 'Failed to update event');
    }
    setEditSaving(false);
  }

  async function handleDeleteEvent() {
    if (!deleteEvent) return;
    setDeleting(true);
    try {
      // First, cascade-delete any pool_matchups that reference this event
      const { data: linkedMatchups } = await supabase
        .from('pool_matchups')
        .select('id')
        .eq('event_id', deleteEvent.id);

      if (linkedMatchups && linkedMatchups.length > 0) {
        const { error: matchupDeleteError } = await supabase
          .from('pool_matchups')
          .delete()
          .eq('event_id', deleteEvent.id);

        if (matchupDeleteError) throw matchupDeleteError;
      }

      // Also delete any lines linked to this event
      await supabase.from('lines').delete().eq('event_id', deleteEvent.id);

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', deleteEvent.id);

      if (error) throw error;

      const matchupCount = linkedMatchups?.length || 0;
      toast.success(`Deleted event: ${deleteEvent.away_team} @ ${deleteEvent.home_team}${matchupCount > 0 ? ` (+ ${matchupCount} linked matchup${matchupCount > 1 ? 's' : ''})` : ''}`);
      setDeleteEvent(null);
      await fetchEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error.message || 'Failed to delete event');
    }
    setDeleting(false);
  }

  function openSpreadOverride(event: Event) {
    setSpreadEvent(event);
    setSpreadHome('');
    setSpreadAway('');
  }

  async function handleUnresolve() {
    if (!unresolveEvent) return;
    setUnresolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('unresolve-event', {
        body: { event_id: unresolveEvent.id },
      });
      if (error) throw error;
      if (data.success) {
        toast.success(`Un-resolved ${data.matchups_unresolved} matchup(s) for ${data.away_team} @ ${data.home_team}`);
        setUnresolveEvent(null);
        fetchEvents();
      } else {
        throw new Error(data.error || 'Failed to un-resolve event');
      }
    } catch (error: any) {
      console.error('Error un-resolving event:', error);
      toast.error(error.message || 'Failed to un-resolve event');
    }
    setUnresolving(false);
  }

  async function handleSpreadOverride() {
    if (!spreadEvent) return;
    const home = parseFloat(spreadHome);
    const away = parseFloat(spreadAway);
    if (isNaN(home) || isNaN(away)) {
      toast.error('Please enter valid spread values');
      return;
    }

    setSpreadSaving(true);
    try {
      const payload = {
        home_spread: home,
        away_spread: away,
        home_team: spreadEvent.home_team,
        away_team: spreadEvent.away_team,
        fetched_at: new Date().toISOString(),
        override_note: 'Admin manual override',
      };

      // Upsert line with admin override
      const { error } = await supabase
        .from('lines')
        .upsert({
          event_id: spreadEvent.id,
          source: 'admin_override',
          book: null,
          locked_line_payload: payload,
          locked_at: new Date().toISOString(),
        }, { onConflict: 'event_id' });

      if (error) throw error;

      toast.success(`Spread override saved for ${spreadEvent.away_team} @ ${spreadEvent.home_team}`);
      setSpreadEvent(null);
    } catch (error: any) {
      console.error('Error saving spread override:', error);
      toast.error(error.message || 'Failed to save spread override');
    }
    setSpreadSaving(false);
  }

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Separate events into pending resolution and resolved
  const pendingResolutionEvents = events.filter(e => e.pending_matchup_count > 0);
  const resolvedEvents = events.filter(e => e.status === 'final' && e.pending_matchup_count === 0);
  const otherEvents = events.filter(e => e.status !== 'final' && e.pending_matchup_count === 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Events & Resolution
              </CardTitle>
              <CardDescription>
                Manage round assignments and resolve event scores
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncOdds}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Games
              </Button>
              {hasPendingChanges && (
                <Button
                  size="sm"
                  onClick={handleSaveChanges}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes ({Object.keys(pendingChanges).length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No events found for this competition.</p>
              <p className="text-sm">Use "Sync Games" to fetch events from the API.</p>
            </div>
          ) : (
            <>
              {/* Events Pending Resolution */}
              {pendingResolutionEvents.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Pending Resolution ({pendingResolutionEvents.length})
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matchup</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Round</TableHead>
                          <TableHead>Pools</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingResolutionEvents.map((event) => {
                          const currentRound = pendingChanges[event.id]?.round_key || event.round_key;
                          const hasChange = !!pendingChanges[event.id];

                          return (
                            <TableRow key={event.id} className={hasChange ? 'bg-primary/5' : ''}>
                              <TableCell className="font-medium">
                                {event.away_team} @ {event.home_team}
                              </TableCell>
                              <TableCell>
                                {event.start_time ? (
                                  format(new Date(event.start_time), 'MMM d, h:mm a')
                                ) : (
                                  <span className="text-muted-foreground">TBD</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    event.status === 'final' ? 'secondary' :
                                    event.status === 'live' ? 'destructive' : 'default'
                                  }
                                >
                                  {event.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={currentRound}
                                  onValueChange={(value) => handleRoundChange(event.id, value)}
                                >
                                  <SelectTrigger className={`w-40 ${hasChange ? 'border-primary' : ''}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rounds.map((round) => (
                                      <SelectItem key={round.key} value={round.key}>
                                        {round.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {event.pending_matchup_count} pool{event.pending_matchup_count !== 1 ? 's' : ''}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button variant="outline" size="sm" onClick={() => openSpreadOverride(event)} title="Override spread">
                                    <Settings2 className="h-3.5 w-3.5 mr-1" />
                                    Spread
                                  </Button>
                                  <Button size="sm" onClick={() => openResolveDialog(event)}>
                                    Resolve
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Other Events (scheduled, no pools) */}
              {otherEvents.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Upcoming ({otherEvents.length})
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matchup</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Round</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {otherEvents.map((event) => {
                          const currentRound = pendingChanges[event.id]?.round_key || event.round_key;
                          const hasChange = !!pendingChanges[event.id];

                          return (
                            <TableRow key={event.id} className={hasChange ? 'bg-primary/5' : ''}>
                              <TableCell className="font-medium">
                                {event.away_team} @ {event.home_team}
                                {event.external_event_id && (
                                  <span className="ml-1 text-xs text-muted-foreground" title="API-imported event">(API)</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {event.start_time ? (
                                  format(new Date(event.start_time), 'MMM d, h:mm a')
                                ) : (
                                  <span className="text-muted-foreground">TBD</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    event.status === 'final' ? 'secondary' :
                                    event.status === 'live' ? 'destructive' : 'default'
                                  }
                                >
                                  {event.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={currentRound}
                                  onValueChange={(value) => handleRoundChange(event.id, value)}
                                >
                                  <SelectTrigger className={`w-40 ${hasChange ? 'border-primary' : ''}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rounds.map((round) => (
                                      <SelectItem key={round.key} value={round.key}>
                                        {round.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSpreadOverride(event)} title="Override spread">
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </Button>
                                  {event.status === 'scheduled' && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(event)} title="Edit event">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteEvent(event)} title="Delete event">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Resolved Events */}
              {resolvedEvents.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-brand-green" />
                    Resolved ({resolvedEvents.length})
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matchup</TableHead>
                          <TableHead>Round</TableHead>
                          <TableHead>Final Score</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resolvedEvents.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium">
                              {event.away_team} @ {event.home_team}
                            </TableCell>
                            <TableCell>{getRoundName(event.round_key)}</TableCell>
                            <TableCell>
                              {event.final_away_score ?? '-'} - {event.final_home_score ?? '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSpreadOverride(event)} title="Override spread">
                                  <Settings2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setUnresolveEvent(event)} title="Un-resolve event">
                                  <Undo2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>



      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Event</DialogTitle>
            <DialogDescription>
              {selectedEvent && (
                <>
                  <span className="font-medium text-foreground">
                    {selectedEvent.away_team} @ {selectedEvent.home_team}
                  </span>
                  <br />
                  <span className="text-xs">{getRoundName(selectedEvent.round_key)}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Affected pools info */}
            {selectedEvent && selectedEvent.affected_pools.length > 0 && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <span className="font-medium">This will resolve matchups in:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedEvent.affected_pools.map(pool => (
                    <Badge key={pool} variant="outline" className="text-xs">
                      {pool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="away-score">{selectedEvent?.away_team} Score</Label>
                <Input
                  id="away-score"
                  type="number"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="home-score">{selectedEvent?.home_team} Score</Label>
                <Input
                  id="home-score"
                  type="number"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="note">Commissioner Note (optional)</Label>
              <Textarea
                id="note"
                value={commissionerNote}
                onChange={(e) => setCommissionerNote(e.target.value)}
                placeholder="Any notes about this resolution..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={resolving}>
              {resolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Resolve {selectedEvent?.pending_matchup_count || 0} Matchup{(selectedEvent?.pending_matchup_count || 0) !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event Manually</DialogTitle>
            <DialogDescription>
              Add a game that doesn't exist in the Odds API yet.
              When the API starts listing this game, it will be automatically adopted — no duplicates.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Home Team</Label>
                <Popover open={homeOpen} onOpenChange={setHomeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={homeOpen} className="w-full justify-between font-normal">
                      {createHomeTeam
                        ? rosterTeams.find(t => t.name === createHomeTeam)?.name || createHomeTeam
                        : 'Select or type team...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search teams..." value={homeSearch} onValueChange={setHomeSearch} />
                      <CommandList>
                        <CommandEmpty>
                          <button
                            type="button"
                            className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm"
                            onClick={() => { setCreateHomeTeam(homeSearch); setHomeOpen(false); setHomeSearch(''); }}
                          >
                            Use "{homeSearch}"
                          </button>
                        </CommandEmpty>
                        <CommandGroup>
                          {rosterTeams.map(t => (
                            <CommandItem
                              key={t.code}
                              value={t.name}
                              onSelect={() => { setCreateHomeTeam(t.name); setHomeOpen(false); setHomeSearch(''); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", createHomeTeam === t.name ? "opacity-100" : "opacity-0")} />
                              {t.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Away Team</Label>
                <Popover open={awayOpen} onOpenChange={setAwayOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={awayOpen} className="w-full justify-between font-normal">
                      {createAwayTeam
                        ? rosterTeams.find(t => t.name === createAwayTeam)?.name || createAwayTeam
                        : 'Select or type team...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search teams..." value={awaySearch} onValueChange={setAwaySearch} />
                      <CommandList>
                        <CommandEmpty>
                          <button
                            type="button"
                            className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm"
                            onClick={() => { setCreateAwayTeam(awaySearch); setAwayOpen(false); setAwaySearch(''); }}
                          >
                            Use "{awaySearch}"
                          </button>
                        </CommandEmpty>
                        <CommandGroup>
                          {rosterTeams.map(t => (
                            <CommandItem
                              key={t.code}
                              value={t.name}
                              onSelect={() => { setCreateAwayTeam(t.name); setAwayOpen(false); setAwaySearch(''); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", createAwayTeam === t.name ? "opacity-100" : "opacity-0")} />
                              {t.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Round</Label>
                <Select value={createRoundKey} onValueChange={setCreateRoundKey}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rounds.map(r => (
                      <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="create-time">Start Time (optional)</Label>
                <Input
                  id="create-time"
                  type="datetime-local"
                  value={createStartTime}
                  onChange={(e) => setCreateStartTime(e.target.value)}
                />
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateEvent} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={!!editEvent} onOpenChange={(open) => !open && setEditEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update event details.
              {editEvent?.external_event_id && (
                <span className="block mt-1 text-amber-500 text-xs font-medium">
                  ⚠ This is an API-imported event. Manual edits may be overwritten on next sync.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Home Team</Label>
                <Popover open={editHomeOpen} onOpenChange={setEditHomeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={editHomeOpen} className="w-full justify-between font-normal">
                      {editHomeTeam || 'Select or type team...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search teams..." value={editHomeSearch} onValueChange={setEditHomeSearch} />
                      <CommandList>
                        <CommandEmpty>
                          <button
                            type="button"
                            className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm"
                            onClick={() => { setEditHomeTeam(editHomeSearch); setEditHomeOpen(false); setEditHomeSearch(''); }}
                          >
                            Use "{editHomeSearch}"
                          </button>
                        </CommandEmpty>
                        <CommandGroup>
                          {rosterTeams.map(t => (
                            <CommandItem
                              key={t.code}
                              value={t.name}
                              onSelect={() => { setEditHomeTeam(t.name); setEditHomeOpen(false); setEditHomeSearch(''); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editHomeTeam === t.name ? "opacity-100" : "opacity-0")} />
                              {t.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Away Team</Label>
                <Popover open={editAwayOpen} onOpenChange={setEditAwayOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={editAwayOpen} className="w-full justify-between font-normal">
                      {editAwayTeam || 'Select or type team...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search teams..." value={editAwaySearch} onValueChange={setEditAwaySearch} />
                      <CommandList>
                        <CommandEmpty>
                          <button
                            type="button"
                            className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm"
                            onClick={() => { setEditAwayTeam(editAwaySearch); setEditAwayOpen(false); setEditAwaySearch(''); }}
                          >
                            Use "{editAwaySearch}"
                          </button>
                        </CommandEmpty>
                        <CommandGroup>
                          {rosterTeams.map(t => (
                            <CommandItem
                              key={t.code}
                              value={t.name}
                              onSelect={() => { setEditAwayTeam(t.name); setEditAwayOpen(false); setEditAwaySearch(''); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editAwayTeam === t.name ? "opacity-100" : "opacity-0")} />
                              {t.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Round</Label>
                <Select value={editRoundKey} onValueChange={setEditRoundKey}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rounds.map(r => (
                      <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Time (optional)</Label>
                <Input
                  type="datetime-local"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEvent(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEvent} onOpenChange={(open) => !open && setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                {deleteEvent?.away_team} @ {deleteEvent?.home_team}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Spread Override Dialog */}
      <Dialog open={!!spreadEvent} onOpenChange={(open) => !open && setSpreadEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Override Spread</DialogTitle>
            <DialogDescription>
              {spreadEvent && (
                <span className="font-medium text-foreground">
                  {spreadEvent.away_team} @ {spreadEvent.home_team}
                </span>
              )}
              <br />
              <span className="text-xs">Set or correct the locked spread for this game. This will override any existing line.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label htmlFor="spread-away">{spreadEvent?.away_team} Spread</Label>
              <Input
                id="spread-away"
                type="number"
                step="0.5"
                value={spreadAway}
                onChange={(e) => setSpreadAway(e.target.value)}
                placeholder="e.g. +3.5"
              />
            </div>
            <div>
              <Label htmlFor="spread-home">{spreadEvent?.home_team} Spread</Label>
              <Input
                id="spread-home"
                type="number"
                step="0.5"
                value={spreadHome}
                onChange={(e) => setSpreadHome(e.target.value)}
                placeholder="e.g. -3.5"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSpreadEvent(null)}>
              Cancel
            </Button>
            <Button onClick={handleSpreadOverride} disabled={spreadSaving}>
              {spreadSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Un-resolve Confirmation */}
      <AlertDialog open={!!unresolveEvent} onOpenChange={() => setUnresolveEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Un-resolve Event</AlertDialogTitle>
            <AlertDialogDescription>
              This will revert <strong>{unresolveEvent?.away_team} @ {unresolveEvent?.home_team}</strong> back to scheduled status, clear its scores, undo any ownership captures, and delete resolution audit entries. The event can then be re-resolved later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unresolving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnresolve} disabled={unresolving}>
              {unresolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Un-resolve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
