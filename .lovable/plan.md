

## Plan: Fix Pool Name Validation + Auto-Lock Lines at Sync Time + Admin Line Override

### Problem 1: Pool Name — Numbers-Only Title
The pool name field uses `z.string().trim().min(1)` which should accept numbers. The real issue is likely the database `name` column or the insert logic rejecting pure-numeric strings. We need to add a clear validation message if the name is rejected, and ensure numeric names work or tell users why they don't.

### Problem 2: Lines Not Locked When Games Start (Critical)
The `sync-odds` function already checks `locked_at` before overwriting a line (line 396). However, the `auto-lock-lines` cron only runs periodically (every 15 min), creating a race window where:
1. A game starts
2. `sync-odds` runs before `auto-lock-lines`
3. `sync-odds` sees `locked_at IS NULL` and overwrites the pre-game spread with a live/shifted line

### Problem 3: No Admin Override for Locked Lines
There's no UI to manually set or correct a locked spread after the fact.

---

### Changes

**1. `supabase/functions/sync-odds/index.ts` — Auto-lock before overwriting**
- Before the "only update line if not locked" check (~line 396), add logic: if the event's `start_time <= now` AND the line exists but isn't locked, **lock the existing line first** (set `locked_at = now`) instead of overwriting it with fresh API data.
- This eliminates the race condition entirely — sync-odds becomes self-healing for the lock gap.
- If no prior line exists for a started game, skip line creation (no spread to lock).

**2. `src/components/admin/EventsManager.tsx` — Admin line override UI**
- Add a "Spread" column or action button on events that are `live` or `final`.
- Clicking opens a small dialog/popover to manually set home/away spread values.
- Saves to the `lines` table as `locked_line_payload` with `source: 'admin_override'` and sets `locked_at` to now.
- This gives admins the ability to correct bad or missing lines post-lock.

**3. `src/pages/CreatePool.tsx` — Pool name validation clarity**
- Add a regex or descriptive validation to the `name` field (e.g., "must contain at least one letter") or confirm numeric names work by testing the insert path. If the DB rejects them, surface a clear error toast with the reason.

### Technical Details
- `sync-odds` change is ~10 lines: check `start_time <= now` on the event, and if so, lock the existing line row instead of overwriting.
- Admin override writes directly to `lines` table, which admins can already update via the `can_manage_line` RLS function.
- No schema/migration changes needed — `locked_line_payload` is already JSONB and `source` is already a text field.

