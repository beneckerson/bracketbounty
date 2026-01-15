import { useEffect, useState } from 'react';
import { COMPETITIONS, CompetitionConfig } from '@/lib/competitions';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CompetitionSeason {
  competition_key: string;
  season: string;
  is_active: boolean;
}

interface CompetitionSelectorProps {
  value: string | null;
  onChange: (competition: CompetitionConfig) => void;
}

export function CompetitionSelector({ value, onChange }: CompetitionSelectorProps) {
  const [activeSeasons, setActiveSeasons] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchActiveSeasons() {
      const { data, error } = await supabase
        .from('competition_seasons')
        .select('competition_key, season, is_active')
        .eq('is_active', true);

      if (!error && data) {
        const seasonsMap: Record<string, string> = {};
        data.forEach((s: CompetitionSeason) => {
          seasonsMap[s.competition_key] = s.season;
        });
        setActiveSeasons(seasonsMap);
      }
    }

    fetchActiveSeasons();
  }, []);

  // Get display season for a competition (from DB or fallback to static)
  const getDisplaySeason = (comp: CompetitionConfig): string => {
    return activeSeasons[comp.key] || comp.season;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {COMPETITIONS.map((comp) => (
        <button
          key={comp.key}
          type="button"
          onClick={() => onChange(comp)}
          className={cn(
            "relative p-6 rounded-xl border-2 text-left transition-all duration-200",
            "hover:border-primary/50 hover:bg-accent/50",
            value === comp.key
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border bg-card"
          )}
        >
          {/* Selected indicator */}
          {value === comp.key && (
            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Icon */}
          <span className="text-4xl mb-3 block">{comp.icon}</span>

          {/* Title */}
          <h3 className="font-display text-xl text-foreground mb-1">{comp.name}</h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-3">{comp.description}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
              {getDisplaySeason(comp)}
            </span>
            {comp.captureEnabled && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                Capture Mode
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
