

## Fix First Four Pairings for March Madness Pool Setup

### Problem
There are no `first_four` events in the database, so the allocation calculator can't detect pairs and shows "4 lowest-seeded teams will be excluded" for 68 teams / 8 players. The existing pairing logic in `start-pool` and `resolve-event` already handles paired ownership and winner transfer — but it needs the events to exist first.

### Root Cause
The admin has no streamlined way to define which 4 pairs of teams are First Four matchups. The NCAAGameSelector only works with API events, and First Four games may not appear in the API until game day.

### Solution: Add "First Four Pairings" Admin UI + Placeholder Events

#### 1. Add First Four Pairings section to EventsManager
**File: `src/components/admin/EventsManager.tsx`**

Add a dedicated "First Four Pairings" card/section that:
- Shows 4 pairing slots, each with two team selectors (from the competition roster)
- On save, creates/updates `first_four` events in the `events` table with `round_key = 'first_four'`, no `external_event_id`
- Also lets the admin link each pairing to a Round of 64 event (set `feeds_into_event_id`) — or auto-create a placeholder R64 event with a known opponent (e.g., BYU vs "First Four Winner")
- Shows existing first_four events if they already exist, pre-populated for editing

Each pairing creates an event like:
```
{
  competition_key: 'march_madness',
  round_key: 'first_four',
  round_order: 0,
  home_team: 'TEXAS_LONGHORNS',
  away_team: 'NC_STATE_WOLFPACK',
  status: 'scheduled',
  event_type: 'game',
  start_time: <user-set or null>
}
```

#### 2. Allow creating placeholder Round of 64 events linked to First Four
When the admin creates a First Four pairing, optionally let them specify the R64 opponent. This creates a placeholder R64 event where one team is the R64 opponent and the other is a TBD placeholder team code (e.g., the home_team of the First Four game as a stand-in). The `feeds_into_event_id` on the First Four event points to this R64 event.

When the actual R64 game appears in the API later, the existing "adoption" logic in `sync-odds` can match it, or the admin can manually link it.

#### 3. Allocation calculator already works — just needs events
Once `first_four` events exist in the DB, the existing code in `CreatePool.tsx` (lines 101-107) correctly counts them and passes `firstFourPairCount` to the `AllocationCalculator`. The `start-pool` function (lines 171-199) already pairs these teams into single slots. The `resolve-event` function (lines 79-127) already transfers ownership from loser to winner.

No changes needed to allocation logic, start-pool, or resolve-event.

#### 4. Minor fix: ensure first_four events aren't shown as matchups in bracket
The bracket view may show First Four as separate matchup cards. Since the user said "don't worry about visual representation of the rounds in the UI" for First Four, we should hide `first_four` round matchups from the bracket display or show them minimally.

### Files to modify
1. **`src/components/admin/EventsManager.tsx`** — Add "First Four Pairings" section with 4 pair slots, team selectors from roster, save creates `first_four` events, optional R64 opponent linkage
2. **`src/components/bracket/BracketView.tsx`** — Optionally hide or collapse `first_four` round in bracket display

### What already works (no changes needed)
- `src/lib/allocation-utils.ts` — First Four pair-aware math
- `src/pages/CreatePool.tsx` — Detects first_four events, passes count to calculator
- `src/components/pool/AllocationCalculator.tsx` — Shows paired allocation info
- `supabase/functions/start-pool/index.ts` — Pairs First Four teams into single ownership slots
- `supabase/functions/resolve-event/index.ts` — Transfers ownership from loser to winner on First Four resolution

