

## Bug: UPSET Results Don't Eliminate Teams

### Root cause
In both `resolve-event` and `re-resolve-event`, the ownership elimination logic handles three cases:
1. **CAPTURED** — winner captures loser's team
2. **Unowned winner** — loser's team is deleted
3. **ADVANCES** — loser's team is deleted

But **UPSET** is never handled. When an underdog wins outright (result_type = `UPSET`), the code falls through without deleting the losing team's ownership record. This is confirmed in your "Gambler's Anonymous" pool — WISCONSIN_BADGERS and OHIO_STATE_BUCKEYES both lost via UPSET but remain in the ownership table.

### Fix
**3 files, ~3 lines each:**

1. **`supabase/functions/resolve-event/index.ts`** (line 240): Change the ADVANCES-only check to also include UPSET:
   - `resultType === 'ADVANCES'` → `(resultType === 'ADVANCES' || resultType === 'UPSET')`

2. **`supabase/functions/re-resolve-event/index.ts`** (line 239): Same change.

3. **`supabase/functions/resolve-matchup/index.ts`** (lines 205-238): This function has a different bug — it always does a capture transfer regardless of result type. It should only capture for CAPTURED results and eliminate (just delete) for ADVANCES/UPSET. Restructure the ownership section to match the logic in `resolve-event`.

### After deploying
You'll need to **re-resolve** the affected events (HIGH_POINT vs WISCONSIN, TCU vs OHIO_STATE) so the losing teams get properly eliminated from ownership.

