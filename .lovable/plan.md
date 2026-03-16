

## Fix Missing Teams + Manual Events (Duplicate-Safe)

### The Problem

1. **53 teams instead of 64+**: Teams like Tennessee aren't imported because their R64 game doesn't exist in the Odds API yet (opponent is a First Four TBD).
2. **4 missing R64 games**: Can't be imported until First Four resolves and lines are posted (Wednesday).
3. **Duplicate risk**: If we manually create those 4 events now, `sync-odds` will create duplicates Wednesday because it upserts on `external_event_id`, which manual events won't have.

### Solution: Team-Based Event Matching in sync-odds

The key change is in `sync-odds`: before inserting a new event, check if an existing event with the **same teams** (home + away, in either order) already exists for that competition but has no `external_event_id`. If found, adopt it by setting its `external_event_id` — no duplicate created.

```text
sync-odds flow (updated):
  1. Get event from Odds API (external_id = "abc123", home = TENNESSEE, away = SMU)
  2. Try upsert on external_event_id → no match (manual event has null external_id)
  3. NEW: Check for existing event with same competition_key + matching team codes
  4. Found manual event → update its external_event_id to "abc123", merge data
  5. Continue as normal (upsert lines, etc.)
```

### Changes

#### 1. `supabase/functions/sync-odds/index.ts` — duplicate-safe matching
Before the existing upsert, add a team-based lookup:
- Query for events where `competition_key` matches AND `external_event_id IS NULL` AND teams match (checking both orientations since home/away might be swapped)
- If found, update that event's `external_event_id` and other fields, then continue
- If not found, proceed with normal upsert as today

#### 2. `src/components/admin/EventsManager.tsx` — manual event creation dialog
Add a "Create Event" button + dialog with:
- Home team and away team text inputs (typed as team codes or selected from roster)
- Round selector
- Start time input
- Optional `feeds_into_event_id` dropdown (link to a First Four game)
- Inserts with `external_event_id = NULL` — the marker that sync-odds uses to identify manually created events

#### 3. `src/components/admin/RosterEditor.tsx` — two additions
- **"Sync from Events" button**: Scans all `events` for this competition, extracts unique team codes, upserts into `teams` table and `competition_rosters`. Catches teams like Tennessee that are already in manually created events.
- **Manual team code input**: A text field to type a team code (e.g., `TENNESSEE_VOLUNTEERS`) and add it directly to both the `teams` table and roster.

#### 4. `src/components/admin/NCAAGameSelector.tsx` — minor fix
Improve abbreviation generation so it doesn't just use the last word of the team name (which causes duplicates like multiple "Eagles").

### Why This Is Safe

- Manual events have `external_event_id = NULL`
- When the Odds API starts returning those games Wednesday, `sync-odds` matches by team codes first, adopts the manual event, and sets its `external_event_id`
- From that point on, normal `external_event_id`-based upserts work
- No duplicates, no broken references — all existing `pool_matchups` pointing to the manual event's ID remain valid

### Files to modify
1. `supabase/functions/sync-odds/index.ts`
2. `src/components/admin/EventsManager.tsx`
3. `src/components/admin/RosterEditor.tsx`
4. `src/components/admin/NCAAGameSelector.tsx`

