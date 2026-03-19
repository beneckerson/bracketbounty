

## Plan: Add "Un-resolve" Event Capability

### What this solves
You resolved matchups before all players joined, so winners were set to `null` (no ownership existed yet). You need to undo those resolutions so that once the pool is started and teams are assigned, the events can be resolved again with correct ownership data.

### Changes

**1. New Edge Function: `unresolve-event`**
- Accepts `event_id`
- For each `pool_matchup` linked to this event:
  - Clears `winner_member_id`, `decided_by`, `decided_at`, `commissioner_note`
  - Deletes any `ownership` records with `acquired_via = 'capture'` and `from_matchup_id` = that matchup (undoes captures)
  - Deletes `audit_log` entries for `action_type = 'matchup_resolved'` matching that matchup
- Resets the event itself: clears `final_home_score`, `final_away_score`, `winner_team_code`, sets `status` back to `scheduled`
- Returns summary of how many matchups were un-resolved

**2. UI: "Un-resolve" button in EventsManager**
- Add an "Actions" column to the **Resolved Events** table (currently has no actions)
- Add an "Un-resolve" button with a confirmation dialog warning that this will revert scores and ownership changes
- Also add the Spread override button to resolved events for completeness
- On success, refresh the events list — the event will move from "Resolved" back to "Pending Resolution" or "Upcoming"

### Technical details
- The edge function uses `SUPABASE_SERVICE_ROLE_KEY` (same pattern as `re-resolve-event`)
- No database migration needed — all operations are deletes/updates on existing tables
- The `resolve-event` function already filters for `winner_member_id IS NULL`, so after un-resolving, re-resolving will pick those matchups up again naturally

