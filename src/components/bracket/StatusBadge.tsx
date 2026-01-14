import { cn } from '@/lib/utils';
import type { EventStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: EventStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('status-badge', status, className)}>
      {status === 'live' && '● Live'}
      {status === 'final' && 'Final'}
      {status === 'upcoming' && 'Upcoming'}
    </span>
  );
}
