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

interface MatchupWithDetails {
  id: string;
  round_id: string;
  event_id: string;
  winner_member_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  commissioner_note: string | null;
  pool: {
    id: string;
    name: string;
    mode: string;
    scoring_rule: string;
    competition_key: string;
    status: string;
  };
  event: {
    id: string;
    home_team: string;
    away_team: string;
    start_time: string | null;
    status: string;
    final_home_score: number | null;
    final_away_score: number | null;
    round_key: string;
    round_order: number;
  } | null;
}

interface MatchupResolverProps {
  competitionKey: string;
}

export function MatchupResolver({ competitionKey }: MatchupResolverProps) {
  const [matchups, setMatchups] = useState<MatchupWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [selectedMatchup, setSelectedMatchup] = useState<MatchupWithDetails | null>(null);
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

  const fetchMatchups = async () => {
    setLoading(true);
    
    // Fetch matchups for active pools in this competition
    // Use event's round_key for accurate round display (not frozen pool_rounds)
    const { data, error } = await supabase
      .from('pool_matchups')
      .select(`
        id,
        round_id,
        event_id,
        winner_member_id,
        decided_by,
        decided_at,
        commissioner_note,
        pool:pools!inner(id, name, mode, scoring_rule, competition_key, status),
        event:events(id, home_team, away_team, start_time, status, final_home_score, final_away_score, round_key, round_order)
      `)
      .eq('pools.competition_key', competitionKey)
      .eq('pools.status', 'active')
      .order('decided_at', { ascending: true, nullsFirst: true });

    if (error) {
      console.error('Error fetching matchups:', error);
      toast.error('Failed to load matchups');
    } else {
      // Transform to expected shape
      const transformed = (data || []).map((m: any) => ({
        ...m,
        pool: m.pool,
        event: m.event,
      }));
      setMatchups(transformed);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMatchups();
  }, [competitionKey]);

  const openResolveDialog = (matchup: MatchupWithDetails) => {
    setSelectedMatchup(matchup);
    setHomeScore(matchup.event?.final_home_score?.toString() || '');
    setAwayScore(matchup.event?.final_away_score?.toString() || '');
    setCommissionerNote(matchup.commissioner_note || '');
  };

  const handleResolve = async () => {
    if (!selectedMatchup) return;

    const home = parseInt(homeScore);
    const away = parseInt(awayScore);

    if (isNaN(home) || isNaN(away)) {
      toast.error('Please enter valid scores');
      return;
    }

    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('resolve-matchup', {
        body: {
          matchup_id: selectedMatchup.id,
          home_score: home,
          away_score: away,
          commissioner_note: commissionerNote || undefined,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Matchup resolved: ${data.result_type || 'ADVANCES'}`);
        setSelectedMatchup(null);
        fetchMatchups();
      } else {
        throw new Error(data.error || 'Failed to resolve matchup');
      }
    } catch (error: any) {
      console.error('Error resolving matchup:', error);
      toast.error(error.message || 'Failed to resolve matchup');
    }
    setResolving(false);
  };

  const unresolvedMatchups = matchups.filter(m => !m.winner_member_id);
  const resolvedMatchups = matchups.filter(m => m.winner_member_id);

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
              Matchup Resolution
            </CardTitle>
            <CardDescription>
              Enter final scores to resolve matchups and trigger ownership transfers
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMatchups}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pending Resolution */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Pending Resolution ({unresolvedMatchups.length})
            </h3>
            {unresolvedMatchups.length === 0 ? (
              <p className="text-muted-foreground text-sm">No matchups awaiting resolution</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pool</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Matchup</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unresolvedMatchups.map((matchup) => (
                    <TableRow key={matchup.id}>
                      <TableCell className="font-medium">{matchup.pool.name}</TableCell>
                      <TableCell>{getRoundName(matchup.event?.round_key)}</TableCell>
                      <TableCell>
                        {matchup.event ? (
                          <span>
                            {matchup.event.away_team} @ {matchup.event.home_team}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No event linked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {matchup.event?.start_time ? (
                          format(new Date(matchup.event.start_time), 'MMM d, h:mm a')
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={matchup.event?.status === 'final' ? 'default' : 'secondary'}>
                          {matchup.event?.status || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openResolveDialog(matchup)}
                          disabled={!matchup.event}
                        >
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
          {resolvedMatchups.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-brand-green" />
                Resolved ({resolvedMatchups.length})
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pool</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Matchup</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Decided By</TableHead>
                    <TableHead>Resolved At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolvedMatchups.map((matchup) => (
                    <TableRow key={matchup.id}>
                      <TableCell className="font-medium">{matchup.pool.name}</TableCell>
                      <TableCell>{getRoundName(matchup.event?.round_key)}</TableCell>
                      <TableCell>
                        {matchup.event ? (
                          <span>
                            {matchup.event.away_team} @ {matchup.event.home_team}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {matchup.event?.final_away_score ?? '-'} - {matchup.event?.final_home_score ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{matchup.decided_by || 'manual'}</Badge>
                      </TableCell>
                      <TableCell>
                        {matchup.decided_at ? (
                          format(new Date(matchup.decided_at), 'MMM d, h:mm a')
                        ) : (
                          '-'
                        )}
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
      <Dialog open={!!selectedMatchup} onOpenChange={() => setSelectedMatchup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Matchup</DialogTitle>
            <DialogDescription>
              {selectedMatchup?.event && (
                <>
                  {selectedMatchup.event.away_team} @ {selectedMatchup.event.home_team}
                  <br />
                  <span className="text-xs">Pool: {selectedMatchup.pool.name} • {getRoundName(selectedMatchup.event.round_key)}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="away-score">{selectedMatchup?.event?.away_team} Score</Label>
                <Input
                  id="away-score"
                  type="number"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="home-score">{selectedMatchup?.event?.home_team} Score</Label>
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

            {selectedMatchup?.pool.mode === 'capture' && selectedMatchup?.pool.scoring_rule === 'ats' && (
              <p className="text-sm text-muted-foreground">
                This is a <strong>Capture Mode + ATS</strong> pool. The team that covers the spread will win the matchup and capture the opponent's team.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMatchup(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={resolving}>
              {resolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Resolve Matchup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
