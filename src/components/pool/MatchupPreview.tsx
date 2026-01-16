import { format } from 'date-fns';
import { SeedBadge } from '@/components/bracket/SeedBadge';
import { TeamBar } from '@/components/bracket/TeamBar';
import type { Team } from '@/lib/types';

export interface MatchupPreviewData {
  id: string;
  awayTeam: Team;
  homeTeam: Team;
  startTime?: Date | null;
  roundKey: string;
}

interface MatchupPreviewProps {
  matchup: MatchupPreviewData;
  className?: string;
}

function formatGameTime(startTime: Date | null | undefined): string | null {
  if (!startTime) return null;
  
  const now = new Date();
  const gameDate = new Date(startTime);
  const isToday = gameDate.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = gameDate.toDateString() === tomorrow.toDateString();
  
  const timeStr = format(gameDate, 'h:mm a');
  
  if (isToday) return `Today @ ${timeStr}`;
  if (isTomorrow) return `Tomorrow @ ${timeStr}`;
  return format(gameDate, 'EEE, MMM d @ h:mm a');
}

export function MatchupPreview({ matchup, className }: MatchupPreviewProps) {
  const gameTime = formatGameTime(matchup.startTime);
  
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border ${className || ''}`}>
      {/* Away Team */}
      <div className="flex items-center gap-2 flex-1">
        <SeedBadge seed={matchup.awayTeam.seed} className="text-xs" />
        <TeamBar team={matchup.awayTeam} className="text-xs px-2 py-0.5" />
      </div>
      
      {/* VS / @ */}
      <span className="text-xs text-muted-foreground font-medium">@</span>
      
      {/* Home Team */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <TeamBar team={matchup.homeTeam} className="text-xs px-2 py-0.5" />
        <SeedBadge seed={matchup.homeTeam.seed} className="text-xs" />
      </div>
      
      {/* Game Time */}
      {gameTime && (
        <div className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap ml-2 min-w-[120px] text-right">
          {gameTime}
        </div>
      )}
    </div>
  );
}

// Group matchups by round for display
export function groupMatchupsByRound(matchups: MatchupPreviewData[]): Record<string, MatchupPreviewData[]> {
  return matchups.reduce((acc, matchup) => {
    if (!acc[matchup.roundKey]) {
      acc[matchup.roundKey] = [];
    }
    acc[matchup.roundKey].push(matchup);
    return acc;
  }, {} as Record<string, MatchupPreviewData[]>);
}
