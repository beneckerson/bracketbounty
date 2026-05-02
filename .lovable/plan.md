## Fix field-event draw count + roll back Derby pool again

### Problem
After the previous re-draw, each of the 8 members got only **1 horse**, leaving 11 in the field. With 19 horses and 8 members, the expected result is **2 horses per member** (16 drawn, 3 in the field).

Root cause: my last fix used `members.length` as the slot count for field events. But field events should respect `teams_per_player` — or, when that's left at the default `1` because the math doesn't divide evenly, auto-derive it from `floor(selected_teams / members)`.

The pool `578c19ac-e9b2-496b-a6c6-299f66494770` was created with `teams_per_player = 1` because the CreatePool wizard only auto-syncs that field when teams divide evenly into players (19 % 8 ≠ 0), so it stayed at the default.

### Fix

#### 1. Edge function `supabase/functions/start-pool/index.ts` — field-event branch

Replace the slot calculation:

```ts
// Determine how many horses each member should receive.
// Prefer the pool's configured teams_per_player; if it's the default 1
// and the math allows more, derive from selected_teams / members so
// uneven counts (e.g. 19 horses / 8 members → 2 each) work intuitively.
const configuredPerMember = pool.teams_per_player ?? 1;
const derivedPerMember = Math.floor(selectedTeams.length / members.length);
const perMember = Math.max(configuredPerMember, derivedPerMember);
const totalToDraw = Math.min(perMember * members.length, selectedTeams.length);

const drawnEntries = sortedBySeed.slice(0, totalToDraw);
const fieldEntries = sortedBySeed.slice(totalToDraw);
```

Then shuffle `drawnEntries` and assign round-robin `index % members.length` (existing logic already does this), so each member ends up with `perMember` horses.

For the current pool: `perMember = max(1, floor(19/8)) = 2`, draws top 16 by seed, leaves the 3 longest shots in the field.

#### 2. CreatePool wizard `src/pages/CreatePool.tsx` (small UX hardening)

For `field_event` competitions, also auto-set `teams_per_player` to `floor(teams / players)` even when it doesn't divide evenly, so the stored value matches reality. This prevents the same confusion if the creator inspects the pool config later.

```ts
useEffect(() => {
  if (effectiveTeamCount > 0 && playerCount > 0) {
    const evenly = effectiveTeamCount % playerCount === 0;
    const isField = selectedCompetition?.format === 'field_event';
    if (evenly || isField) {
      const computed = Math.max(1, Math.floor(effectiveTeamCount / playerCount));
      form.setValue('teamsPerPlayer', computed);
    }
  }
}, [effectiveTeamCount, playerCount, selectedCompetition, form]);
```

#### 3. Roll back pool `578c19ac-e9b2-496b-a6c6-299f66494770`

Same data ops as before:
- `DELETE FROM ownership WHERE pool_id = '578c19ac-...'`
- `DELETE FROM pool_matchups WHERE pool_id = '578c19ac-...'` (none expected for field event, but safe)
- `DELETE FROM pool_rounds WHERE pool_id = '578c19ac-...'`
- `UPDATE pools SET status = 'lobby', winner_member_id = NULL, teams_per_player = 2 WHERE id = '578c19ac-...'` (also bumps the stored value to 2 so the configuration matches)
- Insert `audit_log` entry: `pool_rolled_back` with note about second corrective re-draw.

### Result
Creator hits **Start Pool**, edge function draws the 16 favorites, randomly distributes 2 to each of the 8 members, leaves the 3 longest-shot horses in the field.

### Notes
- No DB schema changes.
- `FieldView.tsx` already renders unowned horses as "In the field" — no UI changes needed.
- Logic still degrades safely if `selected_teams.length < members.length` (totalToDraw clamps to selected_teams.length).
