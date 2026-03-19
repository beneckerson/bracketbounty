

## Fix Team Display Names and Colors in Pool Creation

### Problem 1: Team names display as UPPER_SNAKE_CASE
The `TeamBar` component displays `team.abbreviation`. For NCAAB teams, abbreviations are inconsistent — some are short codes like "MICH", "OSU", others are mascot names like "Wildcats", "Badgers". Multiple teams share the same mascot (e.g., 3 teams all show "Wildcats"). The school name would be far more recognizable.

**Fix**: Update the `abbreviation` column for all NCAAB teams in the database to use the school name instead of the mascot. For example:
- "Kentucky Wildcats" → abbreviation: "Kentucky" (not "Wildcats")
- "Ohio State Buckeyes" → abbreviation: "Ohio St" (not "OSU")
- "North Carolina Tar Heels" → abbreviation: "UNC" (not "Heels")

Also fix the `sync-teams` edge function's `parseTeamName` so future syncs produce school-name abbreviations instead of mascot-only or inconsistent ones.

### Problem 2: Team color indicators broken in TeamSelector
The `TeamSelector` component uses `team.color` (e.g., `"team-orange"`) as an inline CSS `backgroundColor` value at line 232. But `"team-orange"` is a Tailwind token, not valid CSS. The color indicator renders as invisible/transparent.

**Fix**: Convert the Tailwind token to an actual CSS value using `hsl(var(--team-orange))` format in `TeamSelector`.

### Changes

**1. `src/components/pool/TeamSelector.tsx`** — Fix inline color
- Change `style={{ backgroundColor: team.color || 'hsl(var(--muted))' }}` to resolve the token:
  ```
  style={{ backgroundColor: `hsl(var(--${team.color || 'team-gray'}))` }}
  ```

**2. `supabase/functions/sync-teams/index.ts`** — Fix `parseTeamName` to produce school-name abbreviations
- For multi-word team names like "Kentucky Wildcats", use all words except the last (mascot) as the abbreviation: "Kentucky"
- For names like "North Carolina Tar Heels" (mascot is 2 words), apply known multi-word mascot list or just drop last word: "North Carolina Tar" → needs smarter logic
- Best approach: use all-but-last-word, which already exists but was producing the full school name. The real issue is that `parseTeamName` was not being applied during initial team inserts.

**3. Database update** — Fix existing NCAAB team abbreviations
- Run a data update to set `abbreviation` to the school name (all words of `name` except the last word) for all NCAAB teams. This handles most cases correctly (e.g., "Iowa State Cyclones" → "Iowa State", "Duke Blue Devils" → "Duke Blue" — need to handle multi-word mascots)
- Better approach: extract school name by removing known mascot patterns, or simply use all-but-last-word which works for 90%+ of cases

**4. `src/components/pool/MatchupPreview.tsx`** — Already uses `TeamBar` which shows abbreviation, and shows `team.name` as secondary text. No changes needed here once abbreviations are fixed.

### Summary
1. `src/components/pool/TeamSelector.tsx` — Fix color indicator to use CSS variable format
2. `supabase/functions/sync-teams/index.ts` — Fix abbreviation generation for future syncs
3. Database update — Batch-fix existing NCAAB team abbreviations to school names

