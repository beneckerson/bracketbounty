import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Check, Minus } from 'lucide-react';

interface Team {
  code: string;
  name: string;
  abbreviation: string;
  color: string;
  league: string;
}

interface TeamSelectorProps {
  competitionKey: string;
  selectedTeams: string[];
  onChange: (teams: string[]) => void;
}

// Map competition keys to league identifiers
function getLeagueFromCompetition(competitionKey: string): string {
  const leagueMap: Record<string, string> = {
    'cfp_2024': 'CFP',
    'nfl_playoffs_2024': 'NFL',
    'nba_playoffs_2025': 'NBA',
    'nhl_playoffs_2025': 'NHL',
    'mlb_playoffs_2025': 'MLB',
    'march_madness_2025': 'NCAAB',
  };
  return leagueMap[competitionKey] || competitionKey.split('_')[0].toUpperCase();
}

export function TeamSelector({ competitionKey, selectedTeams, onChange }: TeamSelectorProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const league = getLeagueFromCompetition(competitionKey);

  useEffect(() => {
    async function fetchTeams() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('code, name, abbreviation, color, league')
        .eq('league', league)
        .order('name');

      if (fetchError) {
        setError('Failed to load teams');
        console.error('Error fetching teams:', fetchError);
      } else {
        setTeams(data || []);
      }
      setLoading(false);
    }

    if (competitionKey) {
      fetchTeams();
    }
  }, [competitionKey, league]);

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

  if (teams.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
        <p className="text-muted-foreground">No teams found for {league}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Teams will be available after the competition schedule is synced.
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
                  {team?.abbreviation || code}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
