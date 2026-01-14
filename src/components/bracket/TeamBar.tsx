import { cn } from '@/lib/utils';
import type { Team } from '@/lib/types';

interface TeamBarProps {
  team: Team;
  className?: string;
}

const colorMap: Record<string, string> = {
  'team-crimson': 'bg-team-crimson',   // IND, BAMA
  'team-scarlet': 'bg-team-scarlet',   // OSU
  'team-red': 'bg-team-red',           // UGA, TTU
  'team-green': 'bg-team-green',       // ORE
  'team-orange': 'bg-team-orange',     // MIAMI
  'team-navy': 'bg-team-navy',         // MISS
  'team-blue': 'bg-team-blue',
  'team-purple': 'bg-team-purple',
  'team-gold': 'bg-team-gold',
  'team-teal': 'bg-team-teal',
};

export function TeamBar({ team, className }: TeamBarProps) {
  const bgColor = colorMap[team.color] || 'bg-team-navy';
  
  return (
    <div className={cn('team-bar', bgColor, className)}>
      {team.abbreviation}
    </div>
  );
}
