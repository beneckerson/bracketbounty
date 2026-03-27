

## Plan: Filter Out Speculative API Events + Admin Cascade Delete

### Problem
The Odds API publishes odds for **potential** future matchups (e.g., "Texas vs Florida" in the Sweet 16 before the R32 is even finished). The `sync-odds` bridge logic creates pool_matchups for these speculative games because it only requires **one** team to be in `selected_teams`. This creates phantom duplicate matchups in the bracket. Additionally, the admin Events Manager blocks deletion of events linked to pool_matchups, so there's no way to clean up these phantom entries.

### Changes

**1. `supabase/functions/sync-odds/index.ts`** — Tighten the bridge filter (lines 496-504):

Change from requiring *at least one* team in `selected_teams` to requiring **both teams to have active ownership records**. This ensures a matchup is only created when both teams have actually advanced to that round (i.e., they survived prior resolution and still appear in the `ownership` table).

```text
// Current (too loose):
if (!homeInPool && !awayInPool) continue;

// New (requires both teams to have active owners):
// After fetching ownership (line 529-533), skip if either team has no owner
if (!ownerMap[upsertedEvent.home_team] || !ownerMap[upsertedEvent.away_team]) {
  console.log(`Skipping pool ${pool.id}: one or both teams not actively owned`);
  continue;
}
```

This is ~5 lines changed in the bridge section.

**2. `src/components/admin/EventsManager.tsx`** — Allow cascade delete of events with linked pool_matchups:

Change `handleDeleteEvent` to first delete any associated `pool_matchups` rows before deleting the event itself, instead of blocking with "Cannot delete: event is linked to pool matchups". Add a warning in the confirmation dialog showing how many matchups will also be removed.

~15 lines changed in the delete handler + dialog.

**3. Data cleanup** — Delete the phantom speculative matchups and events currently in the Gambler's Anonymous pool. Query for pool_matchups where the event's teams don't match active ownership, then delete them along with orphaned events.

### Summary
- 1 edge function edit (bridge filter tightened)
- 1 UI component edit (cascade delete in admin)
- Data cleanup for existing phantom matchups

