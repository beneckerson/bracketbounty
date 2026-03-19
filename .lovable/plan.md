

## Plan: Allow Commissioner to Rename Members

### Problem
The commissioner needs to rename a guest member ("Rich" → "Wilson") but there's no UI for editing member names.

### Changes

**1. `src/components/pool/ManagePoolDrawer.tsx`** — Add inline rename capability

- Add state for `editingMemberId` and `editingName`
- For each member row (both commissioner and non-creator members), add a pencil/edit icon button
- When clicked, swap the name text for an inline `<Input>` with save/cancel buttons
- On save, call `supabase.from('pool_members').update({ display_name }).eq('id', memberId)`
- Show toast on success, call `onMembersChange()` to refresh

The RLS policy "Creators can manage members" already allows UPDATE for pool creators, so no database changes are needed.

### What stays the same
- Members cannot rename themselves or others through this UI (only the commissioner/creator can)
- Remove button stays as-is
- No new database migrations required

