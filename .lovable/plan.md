

## Plan: Fix Games Showing in Wrong Round

### Root Cause
Two issues combine to put all March Madness games in the Round of 64:

1. **`sync-odds`** hardcodes ALL March Madness events to `round_key: 'round_of_64'` (line 292-293), with a comment "admin will reassign"
2. **`handleSaveChanges` in EventsManager** updates the event's `round_key` in the `events` table, but does NOT update the corresponding `pool_matchups.round_id` — so matchups stay linked to the original Round of 64 pool round even after the admin reassigns the event

### Fix

**1. `supabase/functions/sync-odds/index.ts`** — Add March Madness round auto-detection

Instead of defaulting everything to `round_of_64`, detect the round based on game dates:
- Round of 64: March 20-21 (Thu-Fri of first weekend)
- Round of 32: March 22-23 (Sat-Sun of first weekend)  
- Sweet Sixteen: March 27-28
- Elite Eight: March 29-30
- Final Four: April 5
- Championship: April 7

Use the same date-window approach already used for CFP round detection. This makes new events land in the correct round automatically.

**2. `src/components/admin/EventsManager.tsx`** — Cascade round changes to pool_matchups

When the admin saves round_key changes, also update all `pool_matchups` that reference the changed event. For each changed event:
- Find all `pool_matchups` with that `event_id`
- Look up the pool's `pool_rounds` to find the round matching the new `round_key`
- Update `pool_matchups.round_id` to the correct pool round

**3. Data fix** — Move the 16 existing Round of 32 matchups

The 16 events already have `round_key = 'round_of_32'` in the events table, but their pool_matchups still point to the R64 round. The code change in #2 will let the admin re-save those round assignments to cascade the fix, or we can include a one-time migration to correct existing matchups.

### Technical Details

- No database schema changes needed
- The `pool_matchups` update in #2 requires looking up `pool_rounds` for each affected pool to find the `round_id` matching the new `round_key`
- The admin already has UPDATE access on `pool_matchups` via the "Creators can manage matchups" RLS policy, but since EventsManager operates on events globally, we'll use the service role or ensure the cascade works for all affected pools

