import { cn } from '@/lib/utils';
import type { Round } from '@/lib/types';

interface RoundTabsProps {
  rounds: Round[];
  activeRoundId: string;
  onSelectRound: (roundId: string) => void;
}

export function RoundTabs({ rounds, activeRoundId, onSelectRound }: RoundTabsProps) {
  return (
    <div className="flex overflow-x-auto border-b border-border bg-card sticky top-0 z-10">
      {rounds.map((round) => (
        <button
          key={round.id}
          onClick={() => onSelectRound(round.id)}
          className={cn(
            'round-tab whitespace-nowrap',
            activeRoundId === round.id && 'active'
          )}
        >
          {round.name}
        </button>
      ))}
    </div>
  );
}
