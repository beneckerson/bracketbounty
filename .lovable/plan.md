

## Fix Pool Creation Failure and Team Colors

### Problem 1: "Create Pool" Button Does Nothing
The zod validation schema constrains `teamsPerPlayer` to `max(4)`:
```
teamsPerPlayer: z.number().min(1).max(4)
```
With 32 teams and 2 players, the auto-calculated `teamsPerPlayer` is 16, which silently fails validation. The form never calls `onSubmit` because `handleSubmit` catches the validation error, but there's no visible error rendered for `teamsPerPlayer` on the Review step.

**Fix**: Increase `teamsPerPlayer` max to 32 (half of 64 for March Madness). The largest valid config is 64 teams / 2 players = 32 teams each.

**File: `src/pages/CreatePool.tsx`** (line 31)
- Change `teamsPerPlayer: z.number().min(1).max(4)` to `teamsPerPlayer: z.number().min(1).max(32)`

### Problem 2: All NCAAB Teams Have `team-gray` Color
Every NCAAB team in the database has `color: 'team-gray'`, which:
- Is not defined in `tailwind.config.ts` or `index.css`
- Is not in the `colorMap` in `TeamBar.tsx` (so hash fallback kicks in — this actually works for TeamBar rendering)
- Fails in `TeamSelector` where `team.color` is used as an inline `backgroundColor` CSS value — `'team-gray'` is not valid CSS

**Root cause**: The `sync-teams` edge function uses `hashToColor()` to assign colors, but teams were inserted with the default column value `'team-gray'` instead. This means the sync likely ran before `hashToColor` was added, or the update path didn't work.

**Two fixes**:

**A. Add `team-gray` as a valid fallback** — define it in CSS and Tailwind so it renders as a neutral color:

**File: `src/index.css`** — Add `--team-gray` CSS variable (e.g., `0 0% 50%`)

**File: `tailwind.config.ts`** — Add `gray: "hsl(var(--team-gray))"` to the team colors

**File: `src/components/bracket/TeamBar.tsx`** — Add `'team-gray': 'bg-team-gray'` to `colorMap`

**B. Use hash-based colors for NCAAB teams instead of `team-gray`** — update existing NCAAB teams in the DB to use hashed colors via a migration, or fix the sync-teams function to properly apply colors and re-sync.

I recommend doing both: (A) ensures graceful fallback for any future teams with `team-gray`, and (B) gives NCAAB teams visual variety.

**File: `supabase/functions/sync-teams/index.ts`** — Already uses `hashToColor`, so the update path should set `color: team.color`. Verify this works on re-sync.

**Database migration** — Update existing NCAAB teams to use hash-based colors instead of `team-gray` (one-time fix).

### Summary of Changes
1. `src/pages/CreatePool.tsx` — Raise `teamsPerPlayer` max from 4 to 32
2. `src/index.css` — Add `--team-gray` CSS variable
3. `tailwind.config.ts` — Add `gray` to team colors
4. `src/components/bracket/TeamBar.tsx` — Add `team-gray` to `colorMap`
5. Database migration — Update NCAAB teams' colors from `team-gray` to hash-based values

