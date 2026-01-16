// Palette of distinct avatar colors (muted tones that work well with initials)
const AVATAR_COLORS = [
  { bg: 'hsl(210, 50%, 85%)', text: 'hsl(210, 60%, 30%)' },  // Blue
  { bg: 'hsl(340, 50%, 85%)', text: 'hsl(340, 60%, 30%)' },  // Pink
  { bg: 'hsl(160, 45%, 80%)', text: 'hsl(160, 55%, 28%)' },  // Teal
  { bg: 'hsl(30, 60%, 82%)', text: 'hsl(30, 70%, 30%)' },    // Peach
  { bg: 'hsl(260, 45%, 85%)', text: 'hsl(260, 55%, 35%)' },  // Purple
  { bg: 'hsl(45, 55%, 82%)', text: 'hsl(45, 65%, 28%)' },    // Gold
  { bg: 'hsl(190, 50%, 82%)', text: 'hsl(190, 60%, 28%)' },  // Cyan
  { bg: 'hsl(0, 50%, 85%)', text: 'hsl(0, 60%, 35%)' },      // Coral
  { bg: 'hsl(280, 40%, 85%)', text: 'hsl(280, 50%, 32%)' },  // Violet
  { bg: 'hsl(120, 35%, 82%)', text: 'hsl(120, 45%, 28%)' },  // Sage
  // Additional colors for better distinction
  { bg: 'hsl(180, 45%, 82%)', text: 'hsl(180, 55%, 28%)' },  // Aqua
  { bg: 'hsl(60, 50%, 85%)', text: 'hsl(60, 60%, 28%)' },    // Lime
  { bg: 'hsl(300, 40%, 85%)', text: 'hsl(300, 50%, 32%)' },  // Magenta
  { bg: 'hsl(15, 60%, 82%)', text: 'hsl(15, 70%, 30%)' },    // Rust
  { bg: 'hsl(220, 50%, 82%)', text: 'hsl(220, 60%, 30%)' },  // Indigo
  { bg: 'hsl(80, 40%, 82%)', text: 'hsl(80, 50%, 28%)' },    // Olive
];

/**
 * Simple hash function to convert a string to a number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a consistent avatar color based on participant ID
 * Same ID will always return the same color
 */
export function getAvatarColor(participantId: string): { bg: string; text: string } {
  const index = hashString(participantId) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
