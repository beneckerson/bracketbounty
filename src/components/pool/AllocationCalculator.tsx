import { useMemo, useState } from 'react';
import { calculateAllocation, getValidDivisors } from '@/lib/allocation-utils';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
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
  const [acknowledged, setAcknowledged] = useState(false);

  const allocation = useMemo(
    () => calculateAllocation(teamCount, playerCount),
    [teamCount, playerCount]
  );

  const validDivisors = useMemo(
    () => getValidDivisors(teamCount),
    [teamCount]
  );

  // Reset acknowledged state when player count changes
  useMemo(() => {
    setAcknowledged(false);
  }, [playerCount]);

  // Determine display state
  const isExcluding = !allocation.isValid && allocation.excludedCount > 0;
  const showAcknowledged = isExcluding && acknowledged;

  return (
    <div className="space-y-4">
      {/* Status message - Valid */}
      {allocation.isValid && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            Perfect match — each player gets {allocation.teamsPerPlayer} team{allocation.teamsPerPlayer !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Exclusion warning */}
      {isExcluding && !showAcknowledged && (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {allocation.excludedCount} team{allocation.excludedCount !== 1 ? 's' : ''} won't be assigned
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                The lowest-seeded team{allocation.excludedCount !== 1 ? 's' : ''} will be excluded from the random draw. 
                All {playerCount} players will have exactly {allocation.teamsPerPlayer} team{allocation.teamsPerPlayer !== 1 ? 's' : ''}.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {/* Show closest valid option */}
                {validDivisors.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Find closest valid divisor
                      const closest = validDivisors.reduce((prev, curr) =>
                        Math.abs(curr - playerCount) < Math.abs(prev - playerCount) ? curr : prev
                      );
                      onPlayerCountChange?.(closest);
                    }}
                    className="h-8 text-xs"
                  >
                    Use {validDivisors.reduce((prev, curr) =>
                      Math.abs(curr - playerCount) < Math.abs(prev - playerCount) ? curr : prev
                    )} players instead
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAcknowledged(true)}
                  className="h-8 text-xs"
                >
                  Keep {playerCount} and exclude
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Acknowledged state */}
      {showAcknowledged && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">
          <Info className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">
            {allocation.excludedCount} lowest-seeded team{allocation.excludedCount !== 1 ? 's' : ''} will be excluded
          </span>
        </div>
      )}

      {/* Multi-team warning */}
      {allocation.isValid && allocation.teamsPerPlayer > 1 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Multiple teams per player</p>
            <p className="text-blue-600 dark:text-blue-500">
              With {allocation.teamsPerPlayer} teams each, there's a chance one player's teams could face each other.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
