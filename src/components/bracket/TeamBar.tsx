import { cn } from '@/lib/utils';
import type { Team } from '@/lib/types';

interface TeamBarProps {
  team: Team;
  className?: string;
}

const colorMap: Record<string, string> = {
  'team-red': 'bg-team-red',
  'team-blue': 'bg-team-blue',
  'team-green': 'bg-team-green',
  'team-orange': 'bg-team-orange',
  'team-purple': 'bg-team-purple',
  'team-gold': 'bg-team-gold',
  'team-navy': 'bg-team-navy',
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
