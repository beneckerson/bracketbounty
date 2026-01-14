import { cn } from '@/lib/utils';

interface SeedBadgeProps {
  seed: number;
  className?: string;
}

export function SeedBadge({ seed, className }: SeedBadgeProps) {
  if (seed === 0) return null;
  
  return (
    <div className={cn('seed-badge flex-shrink-0', className)}>
      {seed}
    </div>
  );
}
