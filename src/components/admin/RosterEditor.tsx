import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Trash2, Check, X, Upload, Save, Users } from 'lucide-react';
import { COMPETITIONS } from '@/lib/competitions';

interface RosterEntry {
  id: string;
  team_code: string;
  seed: number | null;
  is_eliminated: boolean;
  eliminated_at: string | null;
}

interface Team {
  code: string;
  name: string;
  abbreviation: string;
  color: string;
  league: string;
}

interface RosterEditorProps {
  competitionKey: string;
  season: string;
}

// Map competition keys to league identifiers
function getLeagueFromCompetition(competitionKey: string): string {
  const leagueMap: Record<string, string> = {
    'cfp': 'CFB',
    'nfl_playoffs': 'NFL',
    'nba_playoffs': 'NBA',
    'nhl_playoffs': 'NHL',
    'mlb_playoffs': 'MLB',
    'march_madness': 'NCAAB',
  };
  return leagueMap[competitionKey] || competitionKey.split('_')[0].toUpperCase();
}

export function RosterEditor({ competitionKey, season }: RosterEditorProps) {
  const { user } = useAuth();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<RosterEntry>>>(new Map());

  const league = getLeagueFromCompetition(competitionKey);
  const competition = COMPETITIONS.find(c => c.key === competitionKey);

  // Fetch roster and available teams
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch existing roster entries
      const { data: rosterData, error: rosterError } = await supabase
        .from('competition_rosters')
        .select('id, team_code, seed, is_eliminated, eliminated_at')
        .eq('competition_key', competitionKey)
        .eq('season', season)
        .order('seed', { ascending: true, nullsFirst: false });

      if (rosterError) {
        console.error('Error fetching roster:', rosterError);
        toast.error('Failed to load roster');
      } else {
        setRoster(rosterData || []);
      }

      // Fetch all teams for this league
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('code, name, abbreviation, color, league')
        .eq('league', league)
        .order('name');

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
      } else {
        setAvailableTeams(teamsData || []);
      }

      setLoading(false);
      setPendingChanges(new Map());
    }

    fetchData();
  }, [competitionKey, season, league]);

  // Get teams not yet in roster
  const teamsNotInRoster = availableTeams.filter(
    t => !roster.some(r => r.team_code === t.code)
  );

  // Add team to roster
  async function addTeam(teamCode: string) {
    if (!user) return;

    const { data, error } = await supabase
      .from('competition_rosters')
      .insert({
        competition_key: competitionKey,
        season,
        team_code: teamCode,
        added_by: user.id,
      })
      .select('id, team_code, seed, is_eliminated, eliminated_at')
      .single();

    if (error) {
      console.error('Error adding team:', error);
      toast.error('Failed to add team');
    } else {
      setRoster([...roster, data]);
      toast.success('Team added to roster');
    }
  }

  // Remove team from roster
  async function removeTeam(id: string) {
    const { error } = await supabase
      .from('competition_rosters')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing team:', error);
      toast.error('Failed to remove team');
    } else {
      setRoster(roster.filter(r => r.id !== id));
      toast.success('Team removed from roster');
    }
  }

  // Update a roster entry locally
  function updateEntry(id: string, updates: Partial<RosterEntry>) {
    const current = pendingChanges.get(id) || {};
    setPendingChanges(new Map(pendingChanges.set(id, { ...current, ...updates })));
  }

  // Save all pending changes
  async function saveChanges() {
    if (pendingChanges.size === 0) return;

    setSaving(true);

    try {
      const promises = Array.from(pendingChanges.entries()).map(([id, updates]) => {
        const updatePayload: Record<string, unknown> = { ...updates };
        if (updates.is_eliminated === true && !updates.eliminated_at) {
          updatePayload.eliminated_at = new Date().toISOString();
        } else if (updates.is_eliminated === false) {
          updatePayload.eliminated_at = null;
        }

        return supabase
          .from('competition_rosters')
          .update(updatePayload)
          .eq('id', id);
      });

      await Promise.all(promises);

      // Update local state
      setRoster(roster.map(r => {
        const changes = pendingChanges.get(r.id);
        if (changes) {
          return {
            ...r,
            ...changes,
            eliminated_at: changes.is_eliminated ? new Date().toISOString() : null,
          };
        }
        return r;
      }));

      setPendingChanges(new Map());
      toast.success('Changes saved');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  // Bulk add all teams
  async function addAllTeams() {
    if (!user || teamsNotInRoster.length === 0) return;

    const inserts = teamsNotInRoster.map(t => ({
      competition_key: competitionKey,
      season,
      team_code: t.code,
      added_by: user.id,
    }));

    const { data, error } = await supabase
      .from('competition_rosters')
      .insert(inserts)
      .select('id, team_code, seed, is_eliminated, eliminated_at');

    if (error) {
      console.error('Error bulk adding teams:', error);
      toast.error('Failed to add teams');
    } else {
      setRoster([...roster, ...(data || [])]);
      toast.success(`Added ${data?.length} teams to roster`);
    }
  }

  // Get the merged value (pending change or current)
  function getValue<K extends keyof RosterEntry>(entry: RosterEntry, key: K): RosterEntry[K] {
    const pending = pendingChanges.get(entry.id);
    if (pending && key in pending) {
      return pending[key] as RosterEntry[K];
    }
    return entry[key];
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
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
            <CardTitle className="flex items-center gap-2">
              {competition?.icon} {competition?.name} {season}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Users className="w-4 h-4" />
              {roster.length} teams in roster
              {roster.filter(r => getValue(r, 'is_eliminated')).length > 0 && (
                <span className="text-destructive">
                  ({roster.filter(r => getValue(r, 'is_eliminated')).length} eliminated)
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {teamsNotInRoster.length > 0 && (
              <Button variant="outline" size="sm" onClick={addAllTeams}>
                <Upload className="w-4 h-4 mr-2" />
                Add All ({teamsNotInRoster.length})
              </Button>
            )}
            {pendingChanges.size > 0 && (
              <Button size="sm" onClick={saveChanges} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes ({pendingChanges.size})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Roster */}
        {roster.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">No teams in roster yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add teams using the button below or bulk import
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {roster
              .sort((a, b) => {
                const seedA = getValue(a, 'seed') ?? 999;
                const seedB = getValue(b, 'seed') ?? 999;
                return seedA - seedB;
              })
              .map((entry) => {
                const team = availableTeams.find(t => t.code === entry.team_code);
                const isEliminated = getValue(entry, 'is_eliminated');
                const seed = getValue(entry, 'seed');

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'flex items-center gap-4 p-3 rounded-lg border transition-colors',
                      isEliminated
                        ? 'bg-muted/50 border-muted opacity-60'
                        : 'bg-card border-border'
                    )}
                  >
                    {/* Team Color */}
                    <div
                      className="w-2 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: team?.color || 'hsl(var(--muted))' }}
                    />

                    {/* Seed Input */}
                    <div className="w-16">
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        placeholder="#"
                        value={seed ?? ''}
                        onChange={(e) => updateEntry(entry.id, {
                          seed: e.target.value ? parseInt(e.target.value) : null
                        })}
                        className="text-center h-8"
                      />
                    </div>

                    {/* Team Info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-medium', isEliminated && 'line-through')}>
                        {team?.name || entry.team_code}
                      </p>
                      <p className="text-xs text-muted-foreground">{team?.abbreviation}</p>
                    </div>

                    {/* Eliminated Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Eliminated</span>
                      <Switch
                        checked={isEliminated}
                        onCheckedChange={(checked) => updateEntry(entry.id, { is_eliminated: checked })}
                      />
                    </div>

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeTeam(entry.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
          </div>
        )}

        {/* Add Team Section */}
        {teamsNotInRoster.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium mb-3">Add Team</p>
            <div className="flex flex-wrap gap-2">
              {teamsNotInRoster.map((team) => (
                <Button
                  key={team.code}
                  variant="outline"
                  size="sm"
                  onClick={() => addTeam(team.code)}
                  className="gap-2"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: team.color || 'hsl(var(--muted))' }}
                  />
                  {team.abbreviation}
                  <Plus className="w-3 h-3" />
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
