import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { resolveTeamColor, TEAM_COLOR_OPTIONS, deriveSchoolAbbreviation, hashToColor } from '@/lib/team-utils';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Save, Users, RefreshCw, Pencil } from 'lucide-react';
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
    'kentucky_derby': 'HORSE',
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
  const [manualTeamCode, setManualTeamCode] = useState('');
  const [syncingFromEvents, setSyncingFromEvents] = useState(false);
  
  // Edit team dialog state
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState('');
  const [editAbbreviation, setEditAbbreviation] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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

  // Sync teams from events already in the database
  async function syncFromEvents() {
    if (!user) return;
    setSyncingFromEvents(true);
    try {
      // Get all events for this competition
      const { data: eventsData, error } = await supabase
        .from('events')
        .select('home_team, away_team')
        .eq('competition_key', competitionKey);

      if (error) throw error;

      // Extract unique team codes
      const teamCodes = new Set<string>();
      (eventsData || []).forEach(e => {
        teamCodes.add(e.home_team);
        teamCodes.add(e.away_team);
      });

      // Filter out teams already in roster
      const existingCodes = new Set(roster.map(r => r.team_code));
      const newCodes = [...teamCodes].filter(c => !existingCodes.has(c));

      if (newCodes.length === 0) {
        toast.info('All teams from events are already in the roster');
        setSyncingFromEvents(false);
        return;
      }

      // Upsert teams into teams table (in case they don't exist)
      const teamsToUpsert = newCodes.map(code => {
        const name = code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return {
          code,
          name,
          abbreviation: deriveSchoolAbbreviation(name),
          league: league,
          color: hashToColor(code),
        };
      });
      await supabase.from('teams').upsert(teamsToUpsert, { onConflict: 'code', ignoreDuplicates: true });

      // Add to competition_rosters
      const rosterInserts = newCodes.map(code => ({
        competition_key: competitionKey,
        season,
        team_code: code,
        added_by: user.id,
      }));

      const { data: newRoster, error: rosterError } = await supabase
        .from('competition_rosters')
        .insert(rosterInserts)
        .select('id, team_code, seed, is_eliminated, eliminated_at');

      if (rosterError) throw rosterError;

      setRoster([...roster, ...(newRoster || [])]);

      // Refresh available teams
      const { data: refreshedTeams } = await supabase
        .from('teams')
        .select('code, name, abbreviation, color, league')
        .eq('league', league)
        .order('name');
      if (refreshedTeams) setAvailableTeams(refreshedTeams);

      toast.success(`Added ${newCodes.length} teams from events`);
    } catch (error: any) {
      console.error('Error syncing from events:', error);
      toast.error(error.message || 'Failed to sync from events');
    }
    setSyncingFromEvents(false);
  }

  // Manually add a team by code
  async function addManualTeam() {
    if (!user || !manualTeamCode.trim()) return;
    const code = manualTeamCode.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

    // Check if already in roster
    if (roster.some(r => r.team_code === code)) {
      toast.info('Team is already in roster');
      return;
    }

    // Upsert into teams table with proper abbreviation and color
    const name = manualTeamCode.trim();
    const abbreviation = deriveSchoolAbbreviation(name);
    const color = hashToColor(code);
    await supabase.from('teams').upsert([{
      code,
      name,
      abbreviation,
      league: league,
      color,
    }], { onConflict: 'code', ignoreDuplicates: true });

    // Add to roster
    const { data, error } = await supabase
      .from('competition_rosters')
      .insert({
        competition_key: competitionKey,
        season,
        team_code: code,
        added_by: user.id,
      })
      .select('id, team_code, seed, is_eliminated, eliminated_at')
      .single();

    if (error) {
      console.error('Error adding manual team:', error);
      toast.error('Failed to add team');
    } else {
      setRoster([...roster, data]);
      setManualTeamCode('');
      // Refresh available teams
      const { data: refreshedTeams } = await supabase
        .from('teams')
        .select('code, name, abbreviation, color, league')
        .eq('league', league)
        .order('name');
      if (refreshedTeams) setAvailableTeams(refreshedTeams);
      toast.success(`Added ${code} to roster`);
    }
  }

  // Open edit dialog for a team
  function openEditTeam(team: Team) {
    setEditingTeam(team);
    setEditName(team.name);
    setEditAbbreviation(team.abbreviation);
    setEditColor(team.color || 'team-gray');
  }

  // Save team metadata edits
  async function saveTeamEdit() {
    if (!editingTeam) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: editName.trim(),
          abbreviation: editAbbreviation.trim(),
          color: editColor,
        })
        .eq('code', editingTeam.code);

      if (error) throw error;

      // Update local state
      setAvailableTeams(prev => prev.map(t =>
        t.code === editingTeam.code
          ? { ...t, name: editName.trim(), abbreviation: editAbbreviation.trim(), color: editColor }
          : t
      ));

      setEditingTeam(null);
      toast.success(`Updated ${editAbbreviation.trim()}`);
    } catch (error: any) {
      console.error('Error updating team:', error);
      toast.error(error.message || 'Failed to update team');
    }
    setEditSaving(false);
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
            <Button variant="outline" size="sm" onClick={syncFromEvents} disabled={syncingFromEvents}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncingFromEvents ? 'animate-spin' : ''}`} />
              Sync from Events
            </Button>
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
                      style={{ backgroundColor: resolveTeamColor(team?.color) }}
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

                    {/* Edit Team Button */}
                    {team && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => openEditTeam(team)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}

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
                    style={{ backgroundColor: resolveTeamColor(team.color) }}
                  />
                  {team.abbreviation}
                  <Plus className="w-3 h-3" />
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Manual Team Code Input */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm font-medium mb-3">Add Team by Code</p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Tennessee Volunteers"
              value={manualTeamCode}
              onChange={(e) => setManualTeamCode(e.target.value)}
              className="max-w-xs"
              onKeyDown={(e) => e.key === 'Enter' && addManualTeam()}
            />
            <Button variant="outline" size="sm" onClick={addManualTeam} disabled={!manualTeamCode.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Name will be converted to UPPER_SNAKE_CASE team code automatically.
          </p>
        </div>
      </CardContent>

      {/* Edit Team Dialog */}
      <Dialog open={!!editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team: {editingTeam?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Abbreviation</Label>
              <Input value={editAbbreviation} onChange={(e) => setEditAbbreviation(e.target.value)} />
              <p className="text-xs text-muted-foreground">Shown on team pills and bracket</p>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.token}
                    type="button"
                    onClick={() => setEditColor(opt.token)}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      editColor === opt.token ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: resolveTeamColor(opt.token) }}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTeam(null)}>Cancel</Button>
            <Button onClick={saveTeamEdit} disabled={editSaving || !editName.trim() || !editAbbreviation.trim()}>
              {editSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
