import { cn } from '@/lib/utils';
import type { Matchup, Pool } from '@/lib/types';
import { SeedBadge } from './SeedBadge';
import { TeamBar } from './TeamBar';
import { StatusBadge } from './StatusBadge';
import { OwnerAvatar } from '@/components/ui/owner-avatar';
import { getParticipantByMemberId } from '@/lib/demo-data';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';

interface MatchupCardProps {
  matchup: Matchup;
  pool: Pool;
  showCapture?: boolean;
  className?: string;
  onClick?: () => void;
}

// Helper to format spread for display
function formatSpread(spread: number | undefined): string {
  if (spread === undefined) return '';
  if (spread > 0) return `+${spread}`;
  return spread.toString();
}

// Helper to determine if a team covered the spread
function didCoverSpread(
  teamScore: number | undefined,
  opponentScore: number | undefined,
  spread: number | undefined
): boolean | null {
  if (teamScore === undefined || opponentScore === undefined || spread === undefined) {
    return null;
  }
  // Spread is from this team's perspective
  // e.g., spread = -7.5 means team needs to win by more than 7.5
  // e.g., spread = +7.5 means team can lose by up to 7.5 and still cover
  const adjustedScore = teamScore + spread;
  return adjustedScore > opponentScore;
}

export function MatchupCard({ matchup, pool, showCapture = true, className, onClick }: MatchupCardProps) {
  const participantA = getParticipantByMemberId(pool, matchup.teamA.ownerId);
  const participantB = getParticipantByMemberId(pool, matchup.teamB.ownerId);
  
  const isTeamAWinner = matchup.winnerId === matchup.teamA.ownerId;
  const isTeamBWinner = matchup.winnerId === matchup.teamB.ownerId;
  
  // ATS (spread) logic
  const isAtsMode = pool.scoringRule === 'ats';
  const teamACovered = didCoverSpread(matchup.teamA.score, matchup.teamB.score, matchup.teamA.spread);
  const teamBCovered = didCoverSpread(matchup.teamB.score, matchup.teamA.score, matchup.teamB.spread);
  const isFinal = matchup.status === 'final';
  
// Determine outcome chip type for capture mode
  // Identify underdog vs favorite by spread (positive spread = underdog)
  const isTeamAUnderdog = (matchup.teamA.spread ?? 0) > 0;
  const underdogEntry = isTeamAUnderdog ? matchup.teamA : matchup.teamB;
  const favoriteEntry = isTeamAUnderdog ? matchup.teamB : matchup.teamA;

  const underdogScore = underdogEntry.score ?? 0;
  const favoriteScore = favoriteEntry.score ?? 0;
  const underdogWonOutright = underdogScore > favoriteScore;
  const underdogCovered = didCoverSpread(underdogEntry.score, favoriteEntry.score, underdogEntry.spread);
  const favoriteCovered = didCoverSpread(favoriteEntry.score, underdogEntry.score, favoriteEntry.spread);

  // Determine chip type:
  // - UPSET: Underdog covers AND wins outright
  // - CAPTURED: Underdog covers BUT loses outright (true capture!)
  // - ADVANCES: Favorite covers and advances normally
  let chipType: 'upset' | 'captured' | 'advances' | null = null;
  if (isFinal && pool.mode === 'capture' && isAtsMode) {
    if (underdogCovered) {
      if (underdogWonOutright) {
        chipType = 'upset';    // Underdog won AND covered
      } else {
        chipType = 'captured'; // Underdog LOST but still covered (true capture!)
      }
    } else if (favoriteCovered) {
      chipType = 'advances';   // Favorite covered and advances
    }
  }

  return (
    <div 
      className={cn('matchup-card cursor-pointer', className)}
      onClick={onClick}
    >
      {/* Team A Row */}
      <div className={cn(
        'team-row',
        isTeamAWinner && 'bg-gradient-to-r from-accent/10 to-transparent'
      )}>
        <SeedBadge seed={matchup.teamA.team.seed} />
        {participantA ? (
          <OwnerAvatar
            displayName={participantA.displayName}
            initials={participantA.initials}
            avatarUrl={participantA.avatarUrl}
            size="md"
          />
        ) : (
          <div className="owner-avatar w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">
            ?
          </div>
        )}
        <div className="flex-1 flex items-center gap-2">
          <TeamBar team={matchup.teamA.team} className="flex-1" />
          {/* Show spread if ATS mode */}
          {isAtsMode && matchup.teamA.spread !== undefined && (
            <span className={cn(
              'text-xs font-semibold px-1.5 py-0.5 rounded',
              matchup.teamA.spread < 0 
                ? 'bg-primary/10 text-primary' 
                : 'bg-muted text-muted-foreground'
            )}>
              {formatSpread(matchup.teamA.spread)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-[70px] justify-end">
          {matchup.teamA.score !== undefined && (
            <span className={cn(
              'font-bold text-lg tabular-nums',
              isTeamAWinner ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {matchup.teamA.score}
            </span>
          )}
          {/* Show covered/failed indicator for ATS mode */}
          {isAtsMode && isFinal && teamACovered !== null && (
            teamACovered ? (
              <span className="flex items-center gap-0.5 text-xs font-bold text-brand-green">
                <TrendingUp className="w-3 h-3" />
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-xs font-bold text-destructive/70">
                <TrendingDown className="w-3 h-3" />
              </span>
            )
          )}
          {isTeamAWinner && (
            <Trophy className="w-4 h-4 text-accent" />
          )}
        </div>
      </div>

      {/* Team B Row */}
      <div className={cn(
        'team-row',
        isTeamBWinner && 'bg-gradient-to-r from-accent/10 to-transparent'
      )}>
        <SeedBadge seed={matchup.teamB.team.seed} />
        {participantB ? (
          <OwnerAvatar
            displayName={participantB.displayName}
            initials={participantB.initials}
            avatarUrl={participantB.avatarUrl}
            size="md"
          />
        ) : (
          <div className="owner-avatar w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">
            ?
          </div>
        )}
        <div className="flex-1 flex items-center gap-2">
          <TeamBar team={matchup.teamB.team} className="flex-1" />
          {/* Show spread if ATS mode */}
          {isAtsMode && matchup.teamB.spread !== undefined && (
            <span className={cn(
              'text-xs font-semibold px-1.5 py-0.5 rounded',
              matchup.teamB.spread < 0 
                ? 'bg-primary/10 text-primary' 
                : 'bg-muted text-muted-foreground'
            )}>
              {formatSpread(matchup.teamB.spread)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-[70px] justify-end">
          {matchup.teamB.score !== undefined && (
            <span className={cn(
              'font-bold text-lg tabular-nums',
              isTeamBWinner ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {matchup.teamB.score}
            </span>
          )}
          {/* Show covered/failed indicator for ATS mode */}
          {isAtsMode && isFinal && teamBCovered !== null && (
            teamBCovered ? (
              <span className="flex items-center gap-0.5 text-xs font-bold text-brand-green">
                <TrendingUp className="w-3 h-3" />
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-xs font-bold text-destructive/70">
                <TrendingDown className="w-3 h-3" />
              </span>
            )
          )}
          {isTeamBWinner && (
            <Trophy className="w-4 h-4 text-accent" />
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
        <StatusBadge status={matchup.status} />
        {chipType === 'upset' && (
          <span className="upset-badge">Upset</span>
        )}
        {chipType === 'captured' && (
          <span className="capture-badge">Captured</span>
        )}
        {chipType === 'advances' && (
          <span className="advances-badge">Advances</span>
        )}
      </div>
    </div>
  );
}
