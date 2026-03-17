// Allocation utilities for team distribution

export interface AllocationResult {
  isValid: boolean;
  teamsPerPlayer: number;
  remainder: number;
  excludedCount: number;
  suggestions: AllocationSuggestion[];
}

export interface AllocationSuggestion {
  playerCount: number;
  teamsPerPlayer: number;
  label: string;
}

/**
 * Calculate if teams divide evenly among players
 * @param firstFourPairs - number of First Four play-in pairs (each pair counts as 1 slot instead of 2)
 */
export function calculateAllocation(teamCount: number, playerCount: number, firstFourPairs: number = 0): AllocationResult {
  if (playerCount <= 0 || teamCount <= 0) {
    return { isValid: false, teamsPerPlayer: 0, remainder: 0, excludedCount: 0, suggestions: [] };
  }

  // For March Madness: each First Four pair counts as 1 slot (not 2 teams)
  const effectiveTeamCount = teamCount - firstFourPairs;
  const teamsPerPlayer = Math.floor(effectiveTeamCount / playerCount);
  const remainder = effectiveTeamCount % playerCount;

  if (remainder === 0 && teamsPerPlayer >= 1) {
    return { isValid: true, teamsPerPlayer, remainder, excludedCount: 0, suggestions: [] };
  }

  // Generate suggestions for valid configurations
  const suggestions = findValidConfigurations(teamCount, playerCount);
  return { isValid: false, teamsPerPlayer, remainder, excludedCount: remainder, suggestions };
}

/**
 * Get valid player count divisors for quick-pick buttons
 */
export function getValidDivisors(teamCount: number): number[] {
  if (teamCount <= 0) return [];
  const divisors: number[] = [];
  for (let p = 2; p <= teamCount && p <= 16; p++) {
    if (teamCount % p === 0) {
      divisors.push(p);
    }
  }
  return divisors;
}

/**
 * Find valid player/team configurations near the current values
 */
export function findValidConfigurations(teamCount: number, currentPlayerCount: number): AllocationSuggestion[] {
  const suggestions: AllocationSuggestion[] = [];
  const seen = new Set<string>();

  // Check player counts that divide evenly (prioritize close to current)
  for (let p = 2; p <= teamCount; p++) {
    if (teamCount % p === 0) {
      const teamsEach = teamCount / p;
      const key = `${p}-${teamsEach}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          playerCount: p,
          teamsPerPlayer: teamsEach,
          label: `${p} players × ${teamsEach} team${teamsEach > 1 ? 's' : ''} each`,
        });
      }
    }
  }

  // Sort by distance from current player count
  suggestions.sort((a, b) => {
    const distA = Math.abs(a.playerCount - currentPlayerCount);
    const distB = Math.abs(b.playerCount - currentPlayerCount);
    return distA - distB;
  });

  return suggestions.slice(0, 6); // Return top 6 closest valid configs
}

/**
 * Get divisibility status message
 */
export function getAllocationStatus(teamCount: number, playerCount: number): {
  status: 'valid' | 'warning' | 'error';
  message: string;
} {
  if (playerCount <= 0) {
    return { status: 'error', message: 'Enter number of players' };
  }
  
  if (teamCount <= 0) {
    return { status: 'error', message: 'Select teams first' };
  }

  const { isValid, teamsPerPlayer, remainder } = calculateAllocation(teamCount, playerCount);

  if (isValid) {
    return {
      status: 'valid',
      message: `${teamCount} teams ÷ ${playerCount} players = ${teamsPerPlayer} team${teamsPerPlayer > 1 ? 's' : ''} each`,
    };
  }

  return {
    status: 'warning',
    message: `${teamCount} teams ÷ ${playerCount} players = ${teamsPerPlayer} each with ${remainder} left over`,
  };
}
