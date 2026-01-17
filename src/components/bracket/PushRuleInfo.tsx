import { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PushRuleInfoProps {
  className?: string;
}

export function PushRuleInfo({ className }: PushRuleInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn('rounded-lg border border-border bg-muted/30', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Push Rule</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 text-sm text-muted-foreground">
          <p>
            When the spread is a whole number (no .5) and the final margin matches the spread exactly, 
            it's a <span className="font-semibold text-foreground">push</span>. In this case, the{' '}
            <span className="font-semibold text-foreground">game winner advances</span>—no capture occurs.
          </p>
        </div>
      )}
    </div>
  );
}
