## Plan: Add Kentucky Derby (Field-Event Competition, Winner-Take-All)

### Approach
Add the Derby as a new competition with a new `field_event` format. Reuses all existing roster, ownership, and member infrastructure — the only "new" surface area is a single-race result entry and a simplified pool view.

- Horses = teams (admin-curated, no API sync)
- Race = 1 round with no head-to-head matchups
- **Winner-take-all**: whoever owns the winning horse wins the pool, period

### Changes

**1. Competition definition** — `src/lib/competitions.ts`
- Add `kentucky_derby` entry with `format: 'field_event'` (new format type alongside `single_elimination`/`series_bracket`).
- No `oddsApiSportKey` (Odds API doesn't cover horse racing).
- `defaultTeamsPerPlayer: 1`, `maxPlayers: 20`, season `'2026'`.

**2. Horse roster** — reuse `competition_rosters` + `teams` tables (no schema changes)
- Horses stored as `teams` rows with `league = 'HORSE'`, plus `competition_rosters` rows with `seed` = post position.
- Extend `RosterEditor.tsx` with an "Add horse" form (name, post position, color) that creates both rows in one go, since there's no `sync-teams` source.
- Existing `TeamSelector` works unchanged; we'll just relabel "seed" → "post" copy when competition is `kentucky_derby`.

**3. Pool start** — `supabase/functions/start-pool/index.ts`
- Add `kentucky_derby: [{ key: 'race', name: 'The Race', order: 1 }]` to `ROUND_CONFIGS`.
- For `field_event` format: create ownership records and the single round, then **skip** event-fetch and matchup creation entirely. Nothing to bridge.

**4. Pool page rendering** — `src/pages/Pool.tsx` + new `src/components/pool/FieldView.tsx`
- Branch on competition format. For `field_event`, render `FieldView`:
  - Header with race name + post time
  - Grid of all horses in the pool, each showing post #, horse name, owner avatar/name
  - Winner badge + trophy on the winning horse once declared
  - Pot total + "Winner: [name]" callout when completed
- Reuse existing `OwnerAvatar`, audit drawer, manage-pool drawer.

**5. Declare winner (admin)** — extend `EventsManager.tsx` (or a small new `DeclareDerbyWinner` component shown only for `field_event` pools)
- Dropdown of horses in the pool's roster → "Declare Winner" button
- On submit (single transaction via edge function or RPC):
  - Set `pools.winner_member_id` to the owner of the winning horse
  - Set `pools.status = 'completed'`
  - Insert audit log entry `derby_winner_declared` with horse code + member name
- Existing winner-display UI (winner banner, venmo unlock via `is_venmo_visible`) lights up automatically since it keys off `pools.winner_member_id` + `status = 'completed'`.

### Explicitly skipped
- No `sync-odds`, `lock-lines`, `resolve-matchup`, `auto-lock-lines` involvement
- No `events` or `lines` rows
- No spreads, ATS scoring, or capture mechanics
- No place/show — winner takes all per your call

### Files touched
- `src/lib/competitions.ts` (add entry + format type)
- `src/lib/types.ts` (extend format union if exported)
- `src/components/admin/RosterEditor.tsx` (add-horse form)
- `src/components/admin/EventsManager.tsx` (Declare Winner section for field events)
- `src/pages/Pool.tsx` (format branch)
- `src/components/pool/FieldView.tsx` (new)
- `supabase/functions/start-pool/index.ts` (round config + skip matchups for field event)
- 1 migration: insert `('kentucky_derby', '2026', true)` into `competition_seasons`

### Effort
~½ to 1 day. Fully additive — does not touch existing bracket/odds/resolve code paths.
