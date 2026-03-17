

## Two Fixes: First Four Allocation + Team Display

### Issue 1: First Four Teams Should Be Paired, Not Excluded

**Current behavior**: With 68 teams and 8 players, 68 % 8 = 4 remainder, so the system warns "4 lowest-seeded excluded." This is wrong for March Madness — the 4 First Four games each produce one winner, so the real team count is 64, not 68.

**Fix**: For March Madness specifically, First Four play-in pairs should be treated as single ownership slots. Both teams in a First Four game go to the same owner. When the game resolves, the winner stays with that owner.

**Changes**:

1. **`src/lib/allocation-utils.ts`** — Add a new export `calculateMarchMadnessAllocation` or add a `firstFourPairs` parameter to `calculateAllocation`. When pairs exist, effective team count = `totalTeams - firstFourPairs` (68 - 4 = 64).

2. **`src/pages/CreatePool.tsx`** — When `competitionKey === 'march_madness'`, detect First Four pairs from events (where `round_key === 'first_four'`). Pass paired count to the allocation calculator so it shows 64 effective teams, not 68. Update the review step summary accordingly.

3. **`src/components/pool/AllocationCalculator.tsx`** — Accept an optional `firstFourPairs` prop. When present, display the effective team count and explain that First Four pairs share an owner slot.

4. **`supabase/functions/start-pool/index.ts`** — When assigning teams for March Madness: identify First Four events, group paired teams, assign both teams in a pair to the same owner as a single "slot." This way 64 slots / 8 players = 8 teams each, no exclusions.

### Issue 2: Team Names and Colors Are Indistinguishable

**Current behavior**: The `TeamBar` component shows only `team.abbreviation` (often just a mascot like "Retrievers," "Bison," "Panthers") with nearly all NCAAB teams defaulting to `team-navy` color. This makes it very hard to tell schools apart.

**Fix**: Show more identifying info and assign varied colors.

**Changes**:

1. **`src/components/pool/MatchupPreview.tsx`** — Instead of just `TeamBar` (which only shows abbreviation), also display the school name or a more descriptive label. Show format like "TCU Frogs" or at minimum the school abbreviation (e.g., "TCU") alongside the mascot.

2. **`supabase/functions/sync-teams/index.ts`** — Improve `parseTeamName` to generate better abbreviations for NCAAB teams. Instead of cryptic initials, use recognizable short forms (e.g., "TCU" not "TH"). Also assign varied colors from the palette based on a hash of the team code instead of defaulting everything to `team-navy`.

3. **`src/components/bracket/TeamBar.tsx`** — Add a `team-gray` color to the colorMap as a distinct fallback. Consider adding a hash-based color assignment for teams without explicit color mappings.

4. **`src/components/admin/NCAAGameSelector.tsx`** — When saving games, generate better abbreviations using common school abbreviations (first word or known mapping) and assign a color from the available palette.

### Files to modify
1. `src/lib/allocation-utils.ts` — First Four pair-aware allocation
2. `src/pages/CreatePool.tsx` — Detect First Four pairs, pass to calculator
3. `src/components/pool/AllocationCalculator.tsx` — Display paired allocation info
4. `supabase/functions/start-pool/index.ts` — Pair-aware team assignment
5. `src/components/pool/MatchupPreview.tsx` — Show school name alongside abbreviation
6. `supabase/functions/sync-teams/index.ts` — Better abbreviations + varied colors
7. `src/components/bracket/TeamBar.tsx` — Hash-based color fallback
8. `src/components/admin/NCAAGameSelector.tsx` — Better abbreviation generation on save

