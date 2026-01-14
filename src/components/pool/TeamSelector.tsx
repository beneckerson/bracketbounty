import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Check, Minus, AlertCircle } from 'lucide-react';
import { getCompetition } from '@/lib/competitions';

interface RosterTeam {
  code: string;
  name: string;
  abbreviation: string;
  color: string;
  seed: number | null;
  is_eliminated: boolean;
}

interface TeamSelectorProps {
  competitionKey: string;
  season: string;
  selectedTeams: string[];
  onChange: (teams: string[]) => void;
}

// Map competition keys to league identifiers
function getLeagueFromCompetition(competitionKey: string): string {
  const leagueMap: Record<string, string> = {
    'nfl_playoffs': 'NFL',
    'nba_playoffs': 'NBA',
    'nhl_playoffs': 'NHL',
    'mlb_playoffs': 'MLB',
    'march_madness': 'NCAAB',
  };
  return leagueMap[competitionKey] || competitionKey.split('_')[0].toUpperCase();
}

export function TeamSelector({ competitionKey, season, selectedTeams, onChange }: TeamSelectorProps) {
  const [teams, setTeams] = useState<RosterTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noRoster, setNoRoster] = useState(false);

  const league = getLeagueFromCompetition(competitionKey);

  useEffect(() => {
    async function fetchTeams() {
      setLoading(true);
      setError(null);
      setNoRoster(false);

      // First try to fetch from competition_rosters (admin-curated)
      const { data: rosterData, error: rosterError } = await supabase
        .from('competition_rosters')
        .select('team_code, seed, is_eliminated')
        .eq('competition_key', competitionKey)
        .eq('season', season)
        .eq('is_eliminated', false)
        .order('seed', { ascending: true, nullsFirst: false });

      if (rosterError) {
        setError('Failed to load teams');
        console.error('Error fetching roster:', rosterError);
        setLoading(false);
        return;
      }

      if (!rosterData || rosterData.length === 0) {
        setNoRoster(true);
        setTeams([]);
        setLoading(false);
        return;
      }

      // Fetch team details for the roster entries
      const teamCodes = rosterData.map(r => r.team_code);
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('code, name, abbreviation, color')
        .in('code', teamCodes);

      if (teamsError) {
        setError('Failed to load team details');
        console.error('Error fetching teams:', teamsError);
        setLoading(false);
        return;
      }

      // Merge roster data with team details
      const mergedTeams: RosterTeam[] = rosterData.map(r => {
        const team = teamsData?.find(t => t.code === r.team_code);
        return {
          code: r.team_code,
          name: team?.name || r.team_code,
          abbreviation: team?.abbreviation || r.team_code,
          color: team?.color || 'hsl(var(--muted))',
          seed: r.seed,
          is_eliminated: r.is_eliminated,
        };
      });

      setTeams(mergedTeams);
      setLoading(false);
    }

    if (competitionKey && season) {
      fetchTeams();
    }
  }, [competitionKey, season, league]);

  const toggleTeam = (code: string) => {
    if (selectedTeams.includes(code)) {
      onChange(selectedTeams.filter((t) => t !== code));
    } else {
      onChange([...selectedTeams, code]);
    }
  };

  const selectAll = () => {
    onChange(teams.map((t) => t.code));
  };

  const clearAll = () => {
    onChange([]);
  };

  const allSelected = teams.length > 0 && selectedTeams.length === teams.length;
  const someSelected = selectedTeams.length > 0 && selectedTeams.length < teams.length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">{error}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Teams may need to be synced for this competition.
        </p>
      </div>
    );
  }

  if (noRoster || teams.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">No roster configured</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          The team roster for this competition hasn't been set up yet. 
          An administrator needs to configure which teams are available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count and batch actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (allSelected ? clearAll() : selectAll())}
            className={cn(
              'flex items-center justify-center w-5 h-5 rounded border-2 transition-colors',
              allSelected
                ? 'bg-primary border-primary text-primary-foreground'
                : someSelected
                  ? 'border-primary bg-primary/20'
                  : 'border-muted-foreground/30'
            )}
          >
            {allSelected && <Check className="w-3 h-3" />}
            {someSelected && !allSelected && <Minus className="w-3 h-3 text-primary" />}
          </button>
          <span className="text-sm font-medium">
            {selectedTeams.length} of {teams.length} teams selected
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAll} disabled={allSelected}>
            Select All
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={selectedTeams.length === 0}>
            Clear
          </Button>
        </div>
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {teams.map((team) => {
          const isSelected = selectedTeams.includes(team.code);
          return (
            <button
              key={team.code}
              type="button"
              onClick={() => toggleTeam(team.code)}
              className={cn(
                'relative flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all duration-150',
                'hover:border-primary/50 hover:bg-accent/50',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-card'
              )}
            >
              {/* Seed badge */}
              {team.seed && (
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <span className="text-xs font-bold text-muted-foreground">{team.seed}</span>
                </div>
              )}

              {/* Team color indicator */}
              <div
                className="w-3 h-8 rounded-sm flex-shrink-0"
                style={{ backgroundColor: team.color || 'hsl(var(--muted))' }}
              />

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{team.name}</p>
                <p className="text-xs text-muted-foreground">{team.abbreviation}</p>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selection summary */}
      {selectedTeams.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Selected teams:</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTeams.map((code) => {
              const team = teams.find((t) => t.code === code);
              return (
                <Badge key={code} variant="secondary" className="text-xs">
                  {team?.seed ? `#${team.seed} ` : ''}{team?.abbreviation || code}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
