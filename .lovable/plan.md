

## Plan: Fix Iowa vs Illinois Missing Matchup + Event Round

### Problem
The Iowa vs Illinois event (`a798e013`) exists in the events table with `round_key = sweet_sixteen`, but there is **no pool_matchup** linking it to the Gambler's Anonymous pool (`6797a523`). This matchup was either never created by sync-odds (blocked by the speculative filter) or was deleted during the recent phantom cleanup. Changing the round in the admin works correctly for the event itself, but since no pool_matchup exists in this pool, nothing renders on the bracket page.

Both Iowa and Illinois are actively owned by the same member (`4c6fe963` — the same person captured both), which is valid but may have confused the bridge logic.

### Changes

**1. Data fix** — Update the event round and create the missing pool_matchup:

```sql
-- Change event round to Elite Eight
UPDATE events
SET round_key = 'elite_eight', round_order = 4
WHERE id = 'a798e013-7c2f-4f0d-a487-dbaa1ae340a8';

-- Create pool_matchup in the GA pool, linking to the Elite Eight round
INSERT INTO pool_matchups (pool_id, round_id, event_id, participant_a_member_id, participant_b_member_id)
VALUES (
  '6797a523-c571-4138-8882-80811702490e',
  '22a75fc8-bea3-4bbc-8e9b-414b4cf0508a',  -- Elite Eight round
  'a798e013-7c2f-4f0d-a487-dbaa1ae340a8',   -- Iowa vs Illinois event
  '4c6fe963-046f-45e0-be80-861309ab7900',    -- Illinois owner (home)
  '4c6fe963-046f-45e0-be80-861309ab7900'     -- Iowa owner (away) — same person
);
```

**2. Admin UI: "Bridge to Pool" button** (`src/components/admin/EventsManager.tsx`)

Add a small action button on events that have 0 linked pool matchups for a given active pool. This lets the admin manually bridge an event into a pool when sync-odds missed it or cleanup removed it. The button would:
- Query active pools for the competition
- Look up ownership for home/away teams in each pool
- Insert a `pool_matchup` with the correct `round_id` and participant member IDs
- Show a toast confirming the bridge

This is ~30-40 lines added to the EventsManager component (a new button + handler).

### Summary
- Data fix: 1 UPDATE + 1 INSERT to restore the missing matchup
- UI enhancement: "Bridge to Pool" admin action for future cases where sync-odds misses a matchup

