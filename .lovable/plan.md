## ✅ Completed: Fix Missing Teams + Manual Events (Duplicate-Safe)

### What was implemented

1. **`sync-odds` duplicate-safe matching**: Before upserting, checks for existing events with `external_event_id IS NULL` and matching team codes (both orientations). If found, adopts the manual event by setting its `external_event_id`. No duplicates when API starts listing those games Wednesday.

2. **Manual event creation dialog in EventsManager**: "Create Event" button opens a dialog with home/away team inputs, round selector, start time, and optional First Four linkage via `feeds_into_event_id`.

3. **RosterEditor improvements**:
   - "Sync from Events" button extracts unique team codes from all imported events and adds missing ones to both `teams` table and `competition_rosters`
   - Manual team code text input to add teams not yet in any event (e.g., Tennessee)

4. **NCAAGameSelector abbreviation fix**: Uses initials + mascot (e.g., "BC Eagles") instead of just the last word to prevent duplicate abbreviations.

## Revised NCAA Tournament Plan — 64 Teams, Play-in Pairs

### Key Clarification

The user wants **maxPlayers: 64**, not 68. The 4 First Four play-in games each produce 1 winner that fills a Round of 64 slot. When a player is assigned a play-in slot, they own **both teams in that play-in game** — so it's effectively 64 draft-able "slots" (60 known teams + 4 play-in pairs).

### How Play-in Pairs Work

- The tournament field has 64 Round of 64 slots
- 4 of those slots are filled by First Four winners
- Each play-in pair (e.g., "Texas Southern / Fairleigh Dickinson") is treated as **one slot** for ownership purposes
- The owner of a play-in pair owns whichever team wins the First Four game
- Before the play-in resolves: bracket shows "Play-in Winner (Team A / Team B)"
- After it resolves: bracket shows the actual winning team

### Database Changes

**Add `feeds_into_event_id` to `events` table:**

```sql
ALTER TABLE events ADD COLUMN feeds_into_event_id uuid REFERENCES events(id);
CREATE INDEX idx_events_feeds_into ON events(feeds_into_event_id) WHERE feeds_into_event_id IS NOT NULL;
```

This links a First Four event to the Round of 64 event it feeds into.

### Competition Config

```typescript
{
  key: 'march_madness',
  name: 'NCAA Tournament',
  shortName: 'NCAAT',
  description: '64-team single-elimination bracket with First Four play-ins',
  format: 'single_elimination',
  captureEnabled: true,
  defaultTeamsPerPlayer: 1,
  maxPlayers: 64,   // 60 known + 4 play-in pairs (each pair = 1 slot)
  icon: '🏀',
  season: '2025-2026',
  oddsApiSportKey: 'basketball_ncaab',
}
```

### Round Definitions

```text
first_four      (order 0) — 4 play-in games (NOT assignable as separate slots)
round_of_64     (order 1) — 32 games (4 slots are play-in pairs)
round_of_32     (order 2) — 16 games
sweet_sixteen   (order 3) — 8 games
elite_eight     (order 4) — 4 games
final_four      (order 5) — 2 games
championship    (order 6) — 1 game
```

### Ownership Logic for Play-in Pairs

When `start-pool` assigns teams for `march_madness`:

- For the 60 "normal" Round of 64 teams: assign ownership as usual (1 team code per slot)
- For the 4 play-in pairs: the pool's `selected_teams` list will contain a **placeholder team code** (e.g., `PLAYIN_1`, `PLAYIN_2`, etc.) representing the pair. The owner of that placeholder owns both First Four teams in the pair.
- When the First Four game resolves, the placeholder ownership transfers to the winning team's actual code.

Alternatively (simpler approach): the admin selects 64 teams in the roster — the 4 play-in slots are each represented by one of the two teams in the pair (e.g., pick the higher-seeded one). When the First Four resolves, the `ownership` record's `team_code` gets updated to the actual winner. The bracket display handles the "Team A / Team B" label via `feeds_into_event_id`.

**Recommended: simpler approach** — no placeholder codes needed. The admin picks 64 team codes for the roster. For play-in slots, the code is initially one of the two First Four teams. The bracket display uses the `feeds_into_event_id` linkage to show both team names. When the First Four resolves, the ownership `team_code` is updated to the actual winner.

### Implementation Steps

#### 1. Database migration
- Add `feeds_into_event_id` to `events`

#### 2. Competition config (`src/lib/competitions.ts`)
- Add `march_madness` entry with `maxPlayers: 64`

#### 3. Round configs
- Add `MARCH_MADNESS_ROUNDS` to `EventsManager.tsx`, `start-pool/index.ts`, and `getRoundsForCompetition()`

#### 4. Edge function: `fetch-ncaab-events`
- Proxy the Odds API `/v4/sports/basketball_ncaab/events` endpoint (free, no quota)
- Returns raw game list for admin manual selection

#### 5. Admin UI: `NCAAGameSelector.tsx`
- Fetches NCAAB events from the edge function
- Admin manually picks tournament games (filtering out NIT, CIT, etc.)
- Assigns rounds (First Four vs Round of 64, etc.)
- For Round of 64 games with TBD teams: dropdown to link to a First Four game via `feeds_into_event_id`

#### 6. Sync-odds updates
- Add `march_madness` → `basketball_ncaab` mapping
- Skip auto-round-detection for march_madness (rounds are admin-assigned)
- Fall through to dynamic team code generation for NCAAB teams

#### 7. Bracket display
- When rendering a matchup where the event has a related First Four game (via `feeds_into_event_id`):
  - Pre-resolution: show "Play-in Winner (Team A / Team B)"
  - Post-resolution: show the actual winner team
- Update `Pool.tsx` data fetching to include `feeds_into_event_id` relationships
- Update `MatchupCard.tsx` and `TeamBar.tsx` for the play-in display variant

#### 8. Resolve-event update for First Four
- When a First Four game resolves, update the `ownership` table to reflect the winning team's code for any pool that had the play-in slot assigned

### Files to Create
1. `supabase/functions/fetch-ncaab-events/index.ts`
2. `src/components/admin/NCAAGameSelector.tsx`

### Files to Modify
1. **Database migration** — `feeds_into_event_id` column
2. `src/lib/competitions.ts` — add `march_madness`
3. `src/components/admin/EventsManager.tsx` — March Madness rounds + NCAAGameSelector integration
4. `supabase/functions/start-pool/index.ts` — March Madness round configs
5. `supabase/functions/sync-odds/index.ts` — NCAAB support
6. `supabase/functions/resolve-event/index.ts` — First Four resolution updates ownership
7. `src/pages/Pool.tsx` — fetch play-in linkage data
8. `src/components/bracket/MatchupCard.tsx` — play-in display
9. `src/components/bracket/TeamBar.tsx` — play-in variant

### Suggested Implementation Order
1. Database migration
2. Competition config + round configs
3. `fetch-ncaab-events` edge function
4. `NCAAGameSelector` admin UI
5. `sync-odds` updates
6. Bracket display for play-in pairs
7. First Four resolution logic in `resolve-event`
