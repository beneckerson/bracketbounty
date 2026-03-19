/**
 * Shared utilities for team code normalization, abbreviation derivation,
 * and color token resolution.
 */

// Known multi-word mascots to strip correctly
const MULTI_WORD_MASCOTS = [
  'Blue Devils', 'Tar Heels', 'Yellow Jackets', 'Blue Hens', 'Horned Frogs',
  'Red Raiders', 'Sun Devils', 'Golden Eagles', 'Scarlet Knights', 'Running Rebels',
  'Mean Green', 'Golden Gophers', 'Nittany Lions', 'Runnin Utes', 'Fighting Irish',
  'Crimson Tide', 'Golden Bears', 'Mountain Hawks', 'River Hawks', 'Red Storm',
  'Blue Jays', 'Orange Men', 'Demon Deacons', 'Black Bears', 'Golden Flashes',
  'Red Foxes', 'Great Danes', 'Black Knights', 'Green Wave', 'Thundering Herd',
  'Flying Dutchmen', 'Purple Eagles', 'Saluki Dogs',
];

/**
 * Convert a human-readable team name to an UPPER_SNAKE_CASE team code.
 * e.g. "Kansas City Chiefs" → "KANSAS_CITY_CHIEFS"
 */
export function toTeamCode(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Derive a school-name abbreviation from a full team name.
 * Strips known mascots (including multi-word) and returns the school portion.
 * e.g. "Duke Blue Devils" → "Duke", "Kentucky Wildcats" → "Kentucky"
 */
export function deriveSchoolAbbreviation(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  // Check multi-word mascots first (longest match wins)
  const sortedMascots = [...MULTI_WORD_MASCOTS].sort((a, b) => b.length - a.length);
  for (const mascot of sortedMascots) {
    if (trimmed.toLowerCase().endsWith(mascot.toLowerCase())) {
      const school = trimmed.slice(0, trimmed.length - mascot.length).trim();
      if (school.length > 0) return school;
    }
  }

  // Fall back to dropping the last word (single-word mascot)
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) return trimmed;
  return words.slice(0, -1).join(' ');
}

/** Team color palette tokens (must match CSS variables in index.css) */
const TEAM_COLOR_PALETTE = [
  'team-crimson', 'team-scarlet', 'team-red', 'team-green', 'team-orange',
  'team-navy', 'team-blue', 'team-purple', 'team-gold', 'team-teal',
];

/** All available team color tokens for admin picker */
export const TEAM_COLOR_OPTIONS = [
  { token: 'team-crimson', label: 'Crimson' },
  { token: 'team-scarlet', label: 'Scarlet' },
  { token: 'team-red', label: 'Red' },
  { token: 'team-green', label: 'Green' },
  { token: 'team-orange', label: 'Orange' },
  { token: 'team-navy', label: 'Navy' },
  { token: 'team-blue', label: 'Blue' },
  { token: 'team-purple', label: 'Purple' },
  { token: 'team-gold', label: 'Gold' },
  { token: 'team-teal', label: 'Teal' },
  { token: 'team-gray', label: 'Gray' },
];

/**
 * Hash a string to a deterministic color token from the palette.
 */
export function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return TEAM_COLOR_PALETTE[Math.abs(hash) % TEAM_COLOR_PALETTE.length];
}

/**
 * Resolve a team color token (e.g. "team-orange") to a valid CSS color string.
 * Use this for inline `style={{ backgroundColor: ... }}`.
 */
export function resolveTeamColor(colorToken: string | null | undefined): string {
  if (!colorToken) return 'hsl(var(--team-gray))';
  // Already a raw CSS color (hex, rgb, hsl)
  if (colorToken.startsWith('#') || colorToken.startsWith('rgb') || colorToken.startsWith('hsl(')) {
    return colorToken;
  }
  // Token like "team-navy" → CSS variable
  return `hsl(var(--${colorToken}))`;
}
