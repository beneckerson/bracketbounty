

## Add Edit and Delete Actions for Events

Currently, event rows only allow changing the round. We need to add edit (teams, start time) and delete capabilities, with safety guards.

### Changes

**File: `src/components/admin/EventsManager.tsx`**

1. **Add a delete handler** that:
   - Checks if the event has any `pool_matchups` referencing it — if so, block deletion with a toast warning ("Cannot delete: event is linked to pool matchups")
   - If safe, deletes the event from `events` table and refreshes the list

2. **Add an edit dialog** (reuse the create dialog pattern) that:
   - Pre-populates with the existing event's home_team, away_team, start_time, round_key
   - Uses the same combobox team selectors
   - On save, updates the event record
   - Only available for events in `scheduled` status (not `live` or `final`)

3. **Add action buttons to each event row** in the "Upcoming" table:
   - An edit (Pencil) icon button that opens the edit dialog
   - A delete (Trash) icon button with a confirmation step
   - These appear in a new "Actions" column on the right side of the Upcoming events table

4. **Safety rules**:
   - Delete is blocked if `pool_matchups` reference the event
   - Edit is only shown for `scheduled` events
   - API-imported events (with `external_event_id`) show a warning that manual edits may be overwritten on next sync

