

## Add Pool Delete for All Pool States

### Problem
The "Manage" button (which contains the delete option) only appears when `pool.status === 'lobby'`. For active or completed pools, commissioners have no way to delete a pool. The database already has `ON DELETE CASCADE` on all child tables (pool_members, pool_matchups, ownership, audit_log, pool_rounds), so deletion will work cleanly.

### Solution
Add a delete button visible to the commissioner on the Pool page regardless of pool status (lobby, active, completed). Keep the existing AlertDialog confirmation pattern.

### Changes

**File: `src/pages/Pool.tsx`**
- Add a delete pool button (e.g., a trash icon or "Delete Pool" in a dropdown) visible to the commissioner (`isCreator`) for all pool statuses, not just lobby
- Could be placed near the pool header/status area as a small icon button, or keep the existing "Manage" button visible for all statuses
- Simplest approach: show the "Manage" button for all statuses when `isCreator`, not just `lobby`. The ManagePoolDrawer already has the delete functionality with confirmation dialog built in
- For active/completed pools where add-guest and start-pool sections aren't relevant, conditionally hide those sections in the drawer

**File: `src/components/pool/ManagePoolDrawer.tsx`**
- Conditionally show "Add Guest Player" and "Start Pool" sections only when `pool.status === 'lobby'`
- Always show the "Players" list and "Danger Zone" (delete) section regardless of status

