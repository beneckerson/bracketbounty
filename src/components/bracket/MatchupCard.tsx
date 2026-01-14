import { cn } from '@/lib/utils';
import type { Matchup, Pool } from '@/lib/types';
import { SeedBadge } from './SeedBadge';
import { TeamBar } from './TeamBar';
import { StatusBadge } from './StatusBadge';
import { OwnerAvatar } from '@/components/ui/owner-avatar';
import { getParticipantByMemberId } from '@/lib/demo-data';
import { Trophy } from 'lucide-react';

interface MatchupCardProps {
  matchup: Matchup;
  pool: Pool;
  showCapture?: boolean;
  className?: string;
  onClick?: () => void;
}

export function MatchupCard({ matchup, pool, showCapture = true, className, onClick }: MatchupCardProps) {
  const participantA = getParticipantByMemberId(pool, matchup.teamA.ownerId);
  const participantB = getParticipantByMemberId(pool, matchup.teamB.ownerId);
  
  const isTeamAWinner = matchup.winnerId === matchup.teamA.ownerId;
  const isTeamBWinner = matchup.winnerId === matchup.teamB.ownerId;
  const hasCaptured = showCapture && pool.mode === 'capture' && matchup.capturedTeams && matchup.capturedTeams.length > 0;

  return (
    <div 
      className={cn('matchup-card cursor-pointer', className)}
      onClick={onClick}
    >
      {/* Team A Row */}
      <div className={cn(
        'team-row',
        isTeamAWinner && 'bg-gradient-to-r from-green-50 to-transparent'
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
        <TeamBar team={matchup.teamA.team} className="flex-1" />
        <div className="flex items-center gap-2 min-w-[50px] justify-end">
          {matchup.teamA.score !== undefined && (
            <span className={cn(
              'font-bold text-lg tabular-nums',
              isTeamAWinner ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {matchup.teamA.score}
            </span>
          )}
          {isTeamAWinner && (
            <Trophy className="w-4 h-4 text-accent" />
          )}
        </div>
      </div>

      {/* Team B Row */}
      <div className={cn(
        'team-row',
        isTeamBWinner && 'bg-gradient-to-r from-green-50 to-transparent'
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
        <TeamBar team={matchup.teamB.team} className="flex-1" />
        <div className="flex items-center gap-2 min-w-[50px] justify-end">
          {matchup.teamB.score !== undefined && (
            <span className={cn(
              'font-bold text-lg tabular-nums',
              isTeamBWinner ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {matchup.teamB.score}
            </span>
          )}
          {isTeamBWinner && (
            <Trophy className="w-4 h-4 text-accent" />
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
        <StatusBadge status={matchup.status} />
        {hasCaptured && (
          <span className="capture-badge">
            Captured
          </span>
        )}
      </div>
    </div>
  );
}
