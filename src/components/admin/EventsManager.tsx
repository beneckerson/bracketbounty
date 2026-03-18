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
import { Calendar, RefreshCw, Loader2, Save, AlertCircle, CheckCircle, Plus, ChevronsUpDown, Check, Pencil, Trash2, Link2 } from 'lucide-react';
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
  { key: 'first_four', name: 'First Four', order: 0 },
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
    first_four: 'First Four',
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
  const [createFeedsInto, setCreateFeedsInto] = useState('');
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
  const [deleting, setDeleting] = useState(false);
  // Fetch roster teams when create or edit dialog opens
  useEffect(() => {
    if (!showCreateDialog && !editEvent) return;
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
  }, [showCreateDialog, editEvent, competitionKey]);

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

      // If feeds_into is set, link the First Four event to this new R64 event
      if (createFeedsInto) {
        await supabase
          .from('events')
          .update({ feeds_into_event_id: newEvent.id })
          .eq('id', createFeedsInto);
      }

      // Also upsert both teams into the teams table
      await supabase.from('teams').upsert([
        { code: homeCode, name: createHomeTeam.trim(), abbreviation: homeCode, league: 'NCAAB' },
        { code: awayCode, name: createAwayTeam.trim(), abbreviation: awayCode, league: 'NCAAB' },
      ], { onConflict: 'code', ignoreDuplicates: true });

      toast.success(`Created event: ${awayCode} @ ${homeCode}`);
      setShowCreateDialog(false);
      setCreateHomeTeam('');
      setCreateAwayTeam('');
      setCreateRoundKey('round_of_64');
      setCreateStartTime('');
      setCreateFeedsInto('');
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

      // Upsert teams
      await supabase.from('teams').upsert([
        { code: homeCode, name: editHomeTeam.trim(), abbreviation: homeCode, league: 'NCAAB' },
        { code: awayCode, name: editAwayTeam.trim(), abbreviation: awayCode, league: 'NCAAB' },
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
      // Check if any pool_matchups reference this event
      const { count } = await supabase
        .from('pool_matchups')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', deleteEvent.id);

      if (count && count > 0) {
        toast.error('Cannot delete: event is linked to pool matchups');
        setDeleteEvent(null);
        setDeleting(false);
        return;
      }

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', deleteEvent.id);

      if (error) throw error;

      toast.success(`Deleted event: ${deleteEvent.away_team} @ ${deleteEvent.home_team}`);
      setDeleteEvent(null);
      await fetchEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error.message || 'Failed to delete event');
    }
    setDeleting(false);
  }

  const firstFourEvents = events.filter(e => e.round_key === 'first_four');

  // First Four Pairings state
  const [ffPairings, setFfPairings] = useState<Array<{
    teamA: string;
    teamB: string;
    r64Opponent: string;
    existingEventId?: string;
    existingR64EventId?: string;
  }>>([]);
  const [ffSaving, setFfSaving] = useState(false);
  const [ffTeamOpens, setFfTeamOpens] = useState<Record<string, boolean>>({});
  const [ffSearches, setFfSearches] = useState<Record<string, string>>({});

  // Initialize pairings from existing first_four events
  useEffect(() => {
    if (competitionKey !== 'march_madness') return;
    
    // Build pairings from existing first_four events
    const existingPairings = firstFourEvents.map(ff => {
      // Find the R64 event that this feeds into
      const r64Event = events.find(e => {
        // Check if any event references this first_four event via feeds_into
        return false; // We check from the other direction
      });
      // Actually check: the first_four event should have feeds_into_event_id set
      // But feeds_into is on the first_four event pointing to R64
      // We need to find the R64 event this FF feeds into
      const linkedR64 = events.find(e => 
        e.round_key !== 'first_four' && 
        firstFourEvents.some(f => f.id === ff.id) &&
        // Check if any first_four event's feeds_into points to this event
        false // We don't have feeds_into_event_id in our Event interface
      );
      
      return {
        teamA: ff.home_team,
        teamB: ff.away_team,
        r64Opponent: '',
        existingEventId: ff.id,
      };
    });

    // Pad to 4 pairings
    while (existingPairings.length < 4) {
      existingPairings.push({ teamA: '', teamB: '', r64Opponent: '', existingEventId: undefined });
    }
    
    setFfPairings(existingPairings);
  }, [events, competitionKey]);

  function setFfTeamOpen(key: string, open: boolean) {
    setFfTeamOpens(prev => ({ ...prev, [key]: open }));
  }
  function setFfSearch(key: string, value: string) {
    setFfSearches(prev => ({ ...prev, [key]: value }));
  }

  async function handleSaveFirstFourPairings() {
    // Validate: each pairing needs both teams
    const activePairings = ffPairings.filter(p => p.teamA || p.teamB);
    for (const p of activePairings) {
      if (!p.teamA || !p.teamB) {
        toast.error('Each pairing needs both teams filled in');
        return;
      }
    }

    setFfSaving(true);
    try {
      for (const pairing of activePairings) {
        const homeCode = pairing.teamA.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
        const awayCode = pairing.teamB.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

        if (pairing.existingEventId) {
          // Update existing event
          await supabase.from('events').update({
            home_team: homeCode,
            away_team: awayCode,
          }).eq('id', pairing.existingEventId);
        } else {
          // Create new first_four event
          const { data: newEvent, error } = await supabase.from('events').insert({
            competition_key: competitionKey,
            round_key: 'first_four',
            round_order: 0,
            home_team: homeCode,
            away_team: awayCode,
            event_type: 'game' as const,
            status: 'scheduled' as const,
          }).select().single();

          if (error) throw error;

          // If R64 opponent specified, create a placeholder R64 event linked to this FF
          if (pairing.r64Opponent && newEvent) {
            const r64OpponentCode = pairing.r64Opponent.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
            const { data: r64Event } = await supabase.from('events').insert({
              competition_key: competitionKey,
              round_key: 'round_of_64',
              round_order: 1,
              home_team: r64OpponentCode,
              away_team: homeCode, // Use FF home team as placeholder
              event_type: 'game' as const,
              status: 'scheduled' as const,
            }).select().single();

            if (r64Event) {
              // Link FF event to R64 event
              await supabase.from('events').update({
                feeds_into_event_id: r64Event.id,
              }).eq('id', newEvent.id);
            }
          }
        }

        // Ensure both teams exist in teams table
        await supabase.from('teams').upsert([
          { code: homeCode, name: pairing.teamA.trim(), abbreviation: homeCode, league: 'NCAAB' },
          { code: awayCode, name: pairing.teamB.trim(), abbreviation: awayCode, league: 'NCAAB' },
        ], { onConflict: 'code', ignoreDuplicates: true });
      }

      toast.success(`Saved ${activePairings.length} First Four pairing(s)`);
      await fetchEvents();
    } catch (error: any) {
      console.error('Error saving First Four pairings:', error);
      toast.error(error.message || 'Failed to save pairings');
    }
    setFfSaving(false);
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
                                <Button size="sm" onClick={() => openResolveDialog(event)}>
                                  Resolve
                                </Button>
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

      {/* Resolve Dialog */}
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
              Add a game that doesn't exist in the Odds API yet (e.g., R64 games with TBD First Four opponents).
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

            {firstFourEvents.length > 0 && (
              <div>
                <Label>Linked First Four Game (optional)</Label>
                <Select value={createFeedsInto || 'none'} onValueChange={v => setCreateFeedsInto(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No play-in link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No play-in link</SelectItem>
                    {firstFourEvents.map(ff => (
                      <SelectItem key={ff.id} value={ff.id}>
                        {ff.away_team} / {ff.home_team}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Links a First Four game so its winner feeds into this event.
                </p>
              </div>
            )}
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
    </>
  );
}
