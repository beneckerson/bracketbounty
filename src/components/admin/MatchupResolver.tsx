import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, AlertCircle, Gavel, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface EventWithPools {
  id: string;
  home_team: string;
  away_team: string;
  start_time: string | null;
  status: string;
  final_home_score: number | null;
  final_away_score: number | null;
  round_key: string;
  round_order: number;
  affected_pools: string[];
  pending_matchup_count: number;
}

interface MatchupResolverProps {
  competitionKey: string;
}

export function MatchupResolver({ competitionKey }: MatchupResolverProps) {
  const [events, setEvents] = useState<EventWithPools[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventWithPools | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [commissionerNote, setCommissionerNote] = useState('');

  // Round name lookup helper
  const getRoundName = (roundKey: string | undefined): string => {
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
      division: 'Division Series',
      world_series: 'World Series',
      stanley_cup: 'Stanley Cup Final',
    };
    return roundNames[roundKey] || roundKey;
  };

  const fetchEvents = async () => {
    setLoading(true);
    
    // Fetch events for this competition that have pending matchups in active pools
    const { data: matchups, error } = await supabase
      .from('pool_matchups')
      .select(`
        id,
        event_id,
        winner_member_id,
        pool:pools!inner(id, name, competition_key, status)
      `)
      .eq('pools.competition_key', competitionKey)
      .eq('pools.status', 'active');

    if (error) {
      console.error('Error fetching matchups:', error);
      toast.error('Failed to load matchups');
      setLoading(false);
      return;
    }

    // Get unique event IDs
    const eventIds = [...new Set((matchups || []).map(m => m.event_id).filter(Boolean))];
    
    if (eventIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    // Fetch events
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .in('id', eventIds)
      .order('round_order', { ascending: true })
      .order('start_time', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      toast.error('Failed to load events');
      setLoading(false);
      return;
    }

    // Group matchups by event and calculate affected pools
    const eventMap = new Map<string, EventWithPools>();
    
    for (const event of eventsData || []) {
      const eventMatchups = (matchups || []).filter(m => m.event_id === event.id);
      const pendingMatchups = eventMatchups.filter(m => !m.winner_member_id);
      const affectedPools = [...new Set(pendingMatchups.map(m => m.pool?.name).filter(Boolean))];
      
      eventMap.set(event.id, {
        id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        start_time: event.start_time,
        status: event.status,
        final_home_score: event.final_home_score,
        final_away_score: event.final_away_score,
        round_key: event.round_key,
        round_order: event.round_order,
        affected_pools: affectedPools as string[],
        pending_matchup_count: pendingMatchups.length,
      });
    }

    setEvents(Array.from(eventMap.values()));
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [competitionKey]);

  const openResolveDialog = (event: EventWithPools) => {
    setSelectedEvent(event);
    setHomeScore(event.final_home_score?.toString() || '');
    setAwayScore(event.final_away_score?.toString() || '');
    setCommissionerNote('');
  };

  const handleResolve = async () => {
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
  };

  const pendingEvents = events.filter(e => e.pending_matchup_count > 0);
  const resolvedEvents = events.filter(e => e.pending_matchup_count === 0 && e.status === 'final');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5" />
              Event Resolution
            </CardTitle>
            <CardDescription>
              Enter scores once per game — all pool matchups resolve automatically
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchEvents}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pending Resolution */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Pending Resolution ({pendingEvents.length} events)
            </h3>
            {pendingEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events awaiting resolution</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matchup</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Pools Affected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        {event.away_team} @ {event.home_team}
                      </TableCell>
                      <TableCell>{getRoundName(event.round_key)}</TableCell>
                      <TableCell>
                        {event.start_time ? (
                          format(new Date(event.start_time), 'MMM d, h:mm a')
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {event.pending_matchup_count} pool{event.pending_matchup_count !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={event.status === 'final' ? 'default' : 'secondary'}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => openResolveDialog(event)}>
                          Resolve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Already Resolved */}
          {resolvedEvents.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-brand-green" />
                Resolved ({resolvedEvents.length} events)
              </h3>
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
