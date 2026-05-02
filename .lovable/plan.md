## Fix Derby distribution + roll back the existing pool

### Problem
For winner-take-all field events (Kentucky Derby), `start-pool` round-robined all 19 horses across 8 members. It should give each member exactly **1 horse**, drawing the **lowest-seeded** horses (the favorites / morning-line top of the field). The remaining horses stay unowned in "the field". The user's current pool needs to be rolled back to lobby so it can be re-drawn correctly.

### 1. Edge function: `supabase/functions/start-pool/index.ts`

For `field_event` competitions only:
- Fetch `seed` for selected horses from `competition_rosters` (matching `competition_key` + `season`).
- Sort selected horses ascending by seed (null seeds → last).
- Take the top **N = members.length** (lowest seed numbers = favorites).
- Shuffle just those N and assign 1:1 to members.
- Skip ownership inserts for the rest — they remain unowned in the field.
- Continue to short-circuit event/matchup creation (already done).

Other competitions: behavior unchanged.

### 2. `FieldView.tsx`

- Accept new prop `selectedTeams: string[]`.
- Build `team_code → member` lookup from `pool.members[].ownedTeams`.
- Render every horse in `selectedTeams`:
  - Owned → owner avatar + name; creator sees "Declare winner" while pool is active.
  - Unowned → muted "In the field" label, no declare button.
- Header subtitle: "{owned} drawn • {unowned} in the field".
- Sort by seed when available (passed through Pool.tsx) so the program reads top-down.

### 3. `Pool.tsx`

- Pass `selectedTeams={pool.selected_teams ?? []}` into `<FieldView />`.

### 4. Roll back pool `578c19ac-e9b2-496b-a6c6-299f66494770`

Data ops (no schema changes):
- `DELETE FROM ownership WHERE pool_id = '578c19ac-...'` — clears the 19 stale assignments.
- `DELETE FROM pool_rounds WHERE pool_id = '578c19ac-...'` — removes "The Race" round.
- `UPDATE pools SET status = 'lobby', winner_member_id = NULL WHERE id = '578c19ac-...'`.
- Insert audit_log: `pool_rolled_back` noting the corrective action.

Then the creator hits **Start Pool** again and the corrected logic runs: 8 favorites randomly distributed to the 8 members; the other 11 horses stay in the field.

### Notes
- No DB schema changes.
- Seeds for all 19 derby horses are already populated in `competition_rosters`.
- If `selected_teams.length <= members.length`, every horse gets an owner (no field).