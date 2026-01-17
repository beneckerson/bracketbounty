import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface OddsAttributionProps {
  lastUpdated?: Date | string | null;
  className?: string;
}

export function OddsAttribution({ lastUpdated, className }: OddsAttributionProps) {
  const formattedTime = lastUpdated 
    ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })
    : null;

  return (
    <div className={cn('text-xs text-muted-foreground', className)}>
      <a 
        href="https://the-odds-api.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        Odds via The Odds API
        <ExternalLink className="w-3 h-3" />
      </a>
      {formattedTime && (
        <span className="block mt-0.5">Updated {formattedTime}</span>
      )}
    </div>
  );
}
