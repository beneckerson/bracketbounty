import { useMemo } from 'react';
import { calculateAllocation, getAllocationStatus, AllocationSuggestion } from '@/lib/allocation-utils';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, Info, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AllocationCalculatorProps {
  teamCount: number;
  playerCount: number;
  onPlayerCountChange?: (count: number) => void;
}

export function AllocationCalculator({
  teamCount,
  playerCount,
  onPlayerCountChange,
}: AllocationCalculatorProps) {
  const allocation = useMemo(
    () => calculateAllocation(teamCount, playerCount),
    [teamCount, playerCount]
  );

  const statusInfo = useMemo(
    () => getAllocationStatus(teamCount, playerCount),
    [teamCount, playerCount]
  );

  const StatusIcon = statusInfo.status === 'valid' 
    ? CheckCircle2 
    : statusInfo.status === 'warning' 
      ? AlertTriangle 
      : Info;

  const statusColors = {
    valid: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900',
    warning: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900',
    error: 'text-muted-foreground bg-muted/50 border-border',
  };

  return (
    <div className="space-y-3">
      {/* Status message */}
      <div className={cn('flex items-center gap-2 p-3 rounded-lg border', statusColors[statusInfo.status])}>
        <StatusIcon className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium">{statusInfo.message}</span>
      </div>

      {/* Multi-team warning */}
      {allocation.isValid && allocation.teamsPerPlayer > 1 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Multiple teams per player</p>
            <p className="text-blue-600 dark:text-blue-500">
              With {allocation.teamsPerPlayer} teams each, there's a chance one player's teams could face each other.
              This is part of the game!
            </p>
          </div>
        </div>
      )}

      {/* Suggestions when invalid */}
      {!allocation.isValid && allocation.suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Valid configurations:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allocation.suggestions.slice(0, 4).map((suggestion) => (
              <SuggestionButton
                key={`${suggestion.playerCount}-${suggestion.teamsPerPlayer}`}
                suggestion={suggestion}
                isCurrentPlayerCount={suggestion.playerCount === playerCount}
                onSelect={() => onPlayerCountChange?.(suggestion.playerCount)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionButton({
  suggestion,
  isCurrentPlayerCount,
  onSelect,
}: {
  suggestion: AllocationSuggestion;
  isCurrentPlayerCount: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onSelect}
      disabled={isCurrentPlayerCount}
      className={cn(
        'justify-start gap-2 h-auto py-2',
        isCurrentPlayerCount && 'opacity-50'
      )}
    >
      <Users className="w-4 h-4 text-muted-foreground" />
      <span>{suggestion.label}</span>
    </Button>
  );
}
