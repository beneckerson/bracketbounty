import { cn } from '@/lib/utils';
import type { Round } from '@/lib/types';

interface RoundTabsProps {
  rounds: Round[];
  activeRoundId: string;
  onSelectRound: (roundId: string) => void;
}

// Mapping of full round names to mobile abbreviations
const mobileAbbreviations: Record<string, string> = {
  'Wild Card': 'WC',
  'Divisional': 'DIV',
  'Conference Championship': 'Conf',
  'Super Bowl': 'SB',
  'First Round': 'R1',
  'Conference Semifinals': 'Semis',
  'Conference Finals': 'CF',
  'NBA Finals': 'Finals',
  'Stanley Cup Final': 'Final',
  'Championship': 'Champ',
};

function getAbbreviation(name: string): string {
  return mobileAbbreviations[name] || name;
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
          <span className="hidden sm:inline">{round.name}</span>
          <span className="sm:hidden">{getAbbreviation(round.name)}</span>
        </button>
      ))}
    </div>
  );
}
