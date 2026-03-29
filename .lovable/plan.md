

## Plan: Fix Three Issues in Gambler's Anonymous Pool

### Issue 1: Ben owns St. John's instead of Duke
The St. John's vs Duke Sweet 16 game resolved correctly in the `pool_matchups` table (Duke won 80-75, spread -6.5, St. John's covered +6.5 = CAPTURED). However, Ben's ownership record still shows `ST_JOHN_S_RED_STORM` instead of `DUKE_BLUE_DEVILS`. The resolve function captured the matchup winner but failed to transfer ownership properly. This is a data-only fix.

```sql
-- Remove wrong ownership
DELETE FROM ownership
WHERE pool_id = '6797a523-c571-4138-8882-80811702490e'
  AND member_id = 'dd04f58f-bbe6-466d-8459-e7bc8a30ff16'
  AND team_code = 'ST_JOHN_S_RED_STORM';

-- Add correct ownership (Ben captured Duke)
INSERT INTO ownership (pool_id, member_id, team_code, acquired_via, from_matchup_id)
VALUES (
  '6797a523-c571-4138-8882-80811702490e',
  'dd04f58f-bbe6-466d-8459-e7bc8a30ff16',
  'DUKE_BLUE_DEVILS',
  'capture',
  '04565f7e-c776-44e1-8c44-f112d5388ff4'
);
```

### Issue 2: Utah State vs Arizona stuck on "Live"
Event `1dcf232f` (Utah State @ Arizona, R32) has `status = 'live'` but the game ended 78-66. The pool_matchup is already resolved. Just need to update the event status.

```sql
UPDATE events
SET status = 'final'
WHERE id = '1dcf232f-a9b4-45bb-8fbe-8388ea7022b2';
```

### Issue 3: Missing Duke/UConn and Michigan/Tennessee Elite Eight matchups
These two real Elite Eight games exist as events but have no `pool_matchup` in the GA pool. The sync-odds bridge couldn't create them because:
- Duke had no ownership record (blocked by Issue 1)
- The bridge may not have run since Sweet 16 resolutions completed

After fixing Issue 1, we manually bridge both matchups. Ownership lookup:
- Duke → Ben (`dd04f58f`) — after fix above
- UConn → Wilson (`3fb6216b`)
- Michigan → Matt (`ffaf4ae6`)
- Tennessee → B Hart (`3a13f4a7`)

```sql
-- Duke vs UConn
INSERT INTO pool_matchups (pool_id, round_id, event_id, participant_a_member_id, participant_b_member_id)
VALUES (
  '6797a523-c571-4138-8882-80811702490e',
  '22a75fc8-bea3-4bbc-8e9b-414b4cf0508a',
  '37367037-431c-4c49-ba72-e923f3765c8d',
  'dd04f58f-bbe6-466d-8459-e7bc8a30ff16',  -- Ben (Duke, home)
  '3fb6216b-2e36-4afc-960e-acff766a444e'   -- Wilson (UConn, away)
);

-- Michigan vs Tennessee
INSERT INTO pool_matchups (pool_id, round_id, event_id, participant_a_member_id, participant_b_member_id)
VALUES (
  '6797a523-c571-4138-8882-80811702490e',
  '22a75fc8-bea3-4bbc-8e9b-414b4cf0508a',
  '94a7b9c5-c021-43d1-a355-59b171643d95',
  'ffaf4ae6-d345-4faf-bf31-5d8e33c67cce',  -- Matt (Michigan, home)
  '3a13f4a7-021a-4294-80f7-4a77e32550dd'   -- B Hart (Tennessee, away)
);
```

### Cleanup: Remove speculative Elite Eight events
Six speculative events remain in the events table (published by the Odds API for matchups that didn't happen). These won't create pool_matchups due to the bridge filter, but cleaning them prevents confusion in the admin panel.

```sql
DELETE FROM events WHERE id IN (
  'acbdd099-8202-431a-ad16-3819100d2aef',  -- Iowa State vs Michigan
  'd5615171-0e4d-4119-8696-1266c46ccbda',  -- Tennessee vs Alabama
  'e8ba3dfc-307d-4f0d-b9f9-2742bdc19ba5',  -- St. John's vs UConn
  'a7a0b7b8-dc47-474f-9c25-1f24ddb8390e',  -- St. John's vs Michigan St
  '48f1abd5-1b71-4d9e-8b8e-5ef12b2ba787',  -- Michigan St vs Duke
  '23a11dd4-1826-4f99-95ca-b1b2f3ff89b0'   -- Alabama vs Iowa State
);
```

### Summary
- 4 data operations, no code changes
- Fixes ownership, event status, missing matchups, and speculative event clutter

