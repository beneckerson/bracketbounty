

## Fix Team Display, Colors, and Play-in Winner Rendering

Three issues to address:

### 1. Team abbreviations should show school name, not mascot initials
**Problem**: `toAbbreviation("BYU Cougars")` produces `"BC Cougars"` (initials of all words before mascot). For college teams, the school name is the recognizable identifier, not initials+mascot.

**Fix**: Change abbreviation logic in both `NCAAGameSelector.tsx` (line 132-138) and `sync-teams/index.ts` (line 33-50) to use the school name(s) instead. For multi-word names like "Boston College Eagles", use "Boston College". For "BYU Cougars", use "BYU". Drop the mascot — school name is clearer.

**Files**: `src/components/admin/NCAAGameSelector.tsx`, `supabase/functions/sync-teams/index.ts`

### 2. TeamBar color logic bug — hash colors don't work for most teams
**Problem**: In `TeamBar.tsx` line 40, the hash fallback only triggers when `team.color === 'team-gray'`. But NCAAGameSelector assigns colors like `'team-crimson'`, `'team-purple'` etc. from the hash palette — these ARE in `colorMap`, so they should work. However, when `team.color` is a value like `'#888888'` (the fallback in Pool.tsx line 458) or some other non-mapped string, it falls through to `bg-team-navy`.

**Fix**: Simplify the TeamBar logic: if `colorMap[team.color]` exists, use it. Otherwise, always use `hashColor(team.code)` as fallback instead of defaulting to navy.

**File**: `src/components/bracket/TeamBar.tsx`

### 3. Play-in winner not rendering in bracket slot
**Problem**: The `getPlayinTeamName` function (Pool.tsx line 431-448) checks if `feederTeamCodes.includes(teamCode)` — but the Round of 64 event's `home_team`/`away_team` may have been set to a specific team code that doesn't match either First Four team (e.g., it could be a placeholder or a pre-resolved winner). When neither condition matches, it falls through to the regular display instead of showing "Play-in Winner (X / Y)".

**Fix**: If a `feederEvent` exists and is not final, always show the play-in label for the team slot that the feeder feeds into, regardless of team code matching. Remove the `feederTeamCodes.includes(teamCode)` check — the mere existence of an unresolved feeder is sufficient.

**File**: `src/pages/Pool.tsx`

### Summary of changes
1. **`src/components/admin/NCAAGameSelector.tsx`** — `toAbbreviation`: return school name without mascot (e.g., "BYU" not "BC Cougars")
2. **`supabase/functions/sync-teams/index.ts`** — `parseTeamName`: same abbreviation fix
3. **`src/components/bracket/TeamBar.tsx`** — Fix color fallback: use `hashColor(team.code)` instead of `bg-team-navy` when no explicit mapping
4. **`src/pages/Pool.tsx`** — `getPlayinTeamName`: show play-in label whenever a feeder event exists and isn't final, without checking team code match

