import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Download, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

const ROUND_OPTIONS = [
  { key: 'first_four', name: 'First Four', order: 0 },
  { key: 'round_of_64', name: 'Round of 64', order: 1 },
  { key: 'round_of_32', name: 'Round of 32', order: 2 },
  { key: 'sweet_sixteen', name: 'Sweet Sixteen', order: 3 },
  { key: 'elite_eight', name: 'Elite Eight', order: 4 },
  { key: 'final_four', name: 'Final Four', order: 5 },
  { key: 'championship', name: 'Championship', order: 6 },
];

interface SelectedGame {
  event: OddsApiEvent;
  roundKey: string;
  roundOrder: number;
  feedsIntoEventId?: string; // For First Four → Round of 64 linkage
}

export function NCAAGameSelector() {
  const [events, setEvents] = useState<OddsApiEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Record<string, SelectedGame>>({});
  const [filter, setFilter] = useState('');
  const [existingFirstFourEvents, setExistingFirstFourEvents] = useState<Array<{ id: string; home_team: string; away_team: string }>>([]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ncaab-events');
      if (error) throw error;
      if (data?.events) {
        setEvents(data.events);
        toast.success(`Fetched ${data.events.length} NCAAB events`);
      }

      // Also fetch existing First Four events for linkage
      const { data: existingFF } = await supabase
        .from('events')
        .select('id, home_team, away_team')
        .eq('competition_key', 'march_madness')
        .eq('round_key', 'first_four');
      
      setExistingFirstFourEvents(existingFF || []);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      toast.error(error.message || 'Failed to fetch events');
    }
    setLoading(false);
  }

  function toggleGame(event: OddsApiEvent) {
    setSelectedGames(prev => {
      if (prev[event.id]) {
        const next = { ...prev };
        delete next[event.id];
        return next;
      }
      return {
        ...prev,
        [event.id]: {
          event,
          roundKey: 'round_of_64',
          roundOrder: 1,
        },
      };
    });
  }

  function setRound(eventId: string, roundKey: string) {
    const round = ROUND_OPTIONS.find(r => r.key === roundKey);
    if (!round) return;
    setSelectedGames(prev => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        roundKey,
        roundOrder: round.order,
      },
    }));
  }

  function setFeedsInto(eventId: string, feedsIntoEventId: string) {
    setSelectedGames(prev => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        feedsIntoEventId: feedsIntoEventId || undefined,
      },
    }));
  }

  function toTeamCode(name: string): string {
    return name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  function toAbbreviation(name: string): string {
    // Use initials of multi-word names to avoid duplicates like "Eagles"
    const words = name.split(/\s+/);
    if (words.length <= 2) return name;
    // For names like "Boston College Eagles", use "BC Eagles"
    const mascot = words[words.length - 1];
    const initials = words.slice(0, -1).map(w => w[0]).join('');
    return `${initials} ${mascot}`;
  }

  async function handleSave() {
    const games = Object.values(selectedGames);
    if (games.length === 0) {
      toast.info('No games selected');
      return;
    }

    setSaving(true);
    try {
      let savedCount = 0;
      const savedEvents: Array<{ id: string; external_event_id: string; round_key: string }> = [];

      for (const game of games) {
        const homeCode = toTeamCode(game.event.home_team);
        const awayCode = toTeamCode(game.event.away_team);

        const eventData = {
          external_event_id: game.event.id,
          competition_key: 'march_madness',
          round_key: game.roundKey,
          round_order: game.roundOrder,
          home_team: homeCode,
          away_team: awayCode,
          start_time: game.event.commence_time,
          status: new Date(game.event.commence_time) > new Date() ? 'scheduled' as const : 'live' as const,
          event_type: 'game' as const,
        };

        const { data: upserted, error } = await supabase
          .from('events')
          .upsert(eventData, { onConflict: 'external_event_id', ignoreDuplicates: false })
          .select('id, external_event_id, round_key')
          .single();

        if (error) {
          console.error('Error saving event:', error);
          continue;
        }

        savedEvents.push(upserted);
        savedCount++;

        // Upsert teams
        const teams = [
          { code: homeCode, name: game.event.home_team, abbreviation: game.event.home_team.split(' ').pop() || homeCode, league: 'NCAAB' },
          { code: awayCode, name: game.event.away_team, abbreviation: game.event.away_team.split(' ').pop() || awayCode, league: 'NCAAB' },
        ];
        await supabase.from('teams').upsert(teams, { onConflict: 'code', ignoreDuplicates: true });
      }

      // After all events saved, set feeds_into_event_id linkages
      for (const game of games) {
        if (game.feedsIntoEventId && game.roundKey !== 'first_four') {
          // This is a Round of 64 game linked to a First Four game
          const savedEvent = savedEvents.find(e => e.external_event_id === game.event.id);
          if (savedEvent) {
            // The First Four event feeds INTO this Round of 64 event
            await supabase
              .from('events')
              .update({ feeds_into_event_id: savedEvent.id } as any)
              .eq('id', game.feedsIntoEventId);
          }
        }
      }

      toast.success(`Saved ${savedCount} tournament games`);
      setSelectedGames({});
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error(error.message || 'Failed to save');
    }
    setSaving(false);
  }

  const filteredEvents = events.filter(e => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return e.home_team.toLowerCase().includes(q) || e.away_team.toLowerCase().includes(q);
  });

  const selectedCount = Object.keys(selectedGames).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              🏀 NCAA Tournament Game Selector
            </CardTitle>
            <CardDescription>
              Manually select tournament games from the Odds API (filters out NIT, CIT, etc.)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Fetch NCAAB Games
            </Button>
            {selectedCount > 0 && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Import {selectedCount} Game{selectedCount !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Click "Fetch NCAAB Games" to load available games from the API.</p>
            <p className="text-xs mt-1">The events endpoint has no quota cost.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by team name..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="max-w-sm"
              />
              <Badge variant="secondary">{filteredEvents.length} games</Badge>
              {selectedCount > 0 && (
                <Badge variant="default">{selectedCount} selected</Badge>
              )}
            </div>
            <div className="rounded-md border max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Matchup</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Feeds Into</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map(event => {
                    const selected = selectedGames[event.id];
                    return (
                      <TableRow key={event.id} className={selected ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={!!selected}
                            onCheckedChange={() => toggleGame(event)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {event.away_team} @ {event.home_team}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(event.commence_time), 'MMM d, h:mm a')}
                        </TableCell>
                        <TableCell>
                          {selected ? (
                            <Select value={selected.roundKey} onValueChange={v => setRound(event.id, v)}>
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROUND_OPTIONS.map(r => (
                                  <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {selected && selected.roundKey !== 'first_four' && existingFirstFourEvents.length > 0 ? (
                            <Select
                              value={selected.feedsIntoEventId || 'none'}
                              onValueChange={v => setFeedsInto(event.id, v === 'none' ? '' : v)}
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue placeholder="No play-in link" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No play-in link</SelectItem>
                                {existingFirstFourEvents.map(ff => (
                                  <SelectItem key={ff.id} value={ff.id}>
                                    {ff.away_team} / {ff.home_team}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
