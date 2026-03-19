

## Make Pool Deletable from Active/Completed State

### Problem
For active/completed pools, `Pool.tsx` returns early at line 747 with only the `BracketView` component. The `ManagePoolDrawer` (which contains the delete button) and the "Manage" button are only rendered in the lobby branch below — they never appear for active/completed pools.

### Solution
Add the ManagePoolDrawer and a "Manage" trigger button into the active/completed pool branch (lines 747-766).

### Changes

**File: `src/pages/Pool.tsx`**
- In the active/completed return block (line 747-766), add:
  - A "Manage" icon button (Settings gear) visible only to `isCreator`, positioned near the top of the bracket view area (e.g., as a floating button or inside a small toolbar above the bracket)
  - The `ManagePoolDrawer` component (same as already rendered in the lobby branch at line 1007)
- This reuses the existing drawer which already conditionally hides lobby-only sections and always shows the Danger Zone / Delete Pool

### Minimal change
Add ~10 lines to the active/completed branch: a Settings button + the ManagePoolDrawer instance. No other files need changes.

