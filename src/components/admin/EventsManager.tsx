import { useState, useEffect } from 'react';
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
import { Calendar, RefreshCw, Loader2, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

function getRoundsForCompetition(competitionKey: string) {
  switch (competitionKey) {
    case 'cfp':
      return CFP_ROUNDS;
    case 'nfl_playoffs':
      return NFL_ROUNDS;
    case 'mlb_playoffs':
      return MLB_ROUNDS;
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
    </>
  );
}
