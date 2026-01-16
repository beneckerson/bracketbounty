import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, RefreshCw, Loader2, Save, AlertCircle } from 'lucide-react';
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

export function EventsManager({ competitionKey }: EventsManagerProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, { round_key: string; round_order: number }>>({});

  const rounds = getRoundsForCompetition(competitionKey);

  useEffect(() => {
    fetchEvents();
  }, [competitionKey]);

  async function fetchEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('competition_key', competitionKey)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } else {
      setEvents(data || []);
    }
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

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Events & Round Management
            </CardTitle>
            <CardDescription>
              View and manage synced events and their round assignments
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
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No events found for this competition.</p>
            <p className="text-sm">Use "Sync Games" to fetch events from the API.</p>
          </div>
        ) : (
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
                {events.map((event) => {
                  const currentRound = pendingChanges[event.id]?.round_key || event.round_key;
                  const hasChange = !!pendingChanges[event.id];
                  
                  return (
                    <TableRow key={event.id} className={hasChange ? 'bg-primary/5' : ''}>
                      <TableCell className="font-medium">
                        {event.away_team} @ {event.home_team}
                      </TableCell>
                      <TableCell>
                        {event.start_time ? (
                          format(new Date(event.start_time), 'MMM d, yyyy h:mm a')
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
                          <SelectTrigger className={`w-48 ${hasChange ? 'border-primary' : ''}`}>
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
        )}
      </CardContent>
    </Card>
  );
}
