import { cn } from '@/lib/utils';
import type { Team } from '@/lib/types';

interface TeamBarProps {
  team: Team;
  className?: string;
}

const colorMap: Record<string, string> = {
  'team-crimson': 'bg-team-crimson',
  'team-scarlet': 'bg-team-scarlet',
  'team-red': 'bg-team-red',
  'team-green': 'bg-team-green',
  'team-orange': 'bg-team-orange',
  'team-navy': 'bg-team-navy',
  'team-blue': 'bg-team-blue',
  'team-purple': 'bg-team-purple',
  'team-gold': 'bg-team-gold',
  'team-teal': 'bg-team-teal',
  'team-gray': 'bg-team-gray',
};

// Hash-based color for teams without explicit color mapping
const HASH_COLORS = [
  'bg-team-crimson', 'bg-team-scarlet', 'bg-team-red', 'bg-team-green',
  'bg-team-orange', 'bg-team-blue', 'bg-team-purple', 'bg-team-gold', 'bg-team-teal',
];

function hashColor(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = ((hash << 5) - hash) + code.charCodeAt(i);
    hash |= 0;
  }
  return HASH_COLORS[Math.abs(hash) % HASH_COLORS.length];
}

export function TeamBar({ team, className }: TeamBarProps) {
  const explicitColor = colorMap[team.color];
  // Use explicit color if mapped, otherwise always hash-based fallback
  const bgColor = explicitColor || hashColor(team.code);
  
  return (
    <div className={cn('team-bar', bgColor, className)}>
      {team.abbreviation}
    </div>
  );
}
