

## Fix: Eliminate Teams From Already-Resolved UPSET Matchups

### What's happening
The UPSET bug fix you approved earlier is deployed, so **future** resolutions will correctly eliminate teams. But the 4 matchups in "Gambler's Anonymous" were resolved **before** the fix, so WISCONSIN_BADGERS and OHIO_STATE_BUCKEYES (both owned by Rich) still sit in the ownership table despite losing.

### Solution
You need to **re-resolve** the two affected events using the admin Events Manager (Undo → Resolve). The corrected edge function code will then properly delete those ownership records.

The two event IDs are:
- `f40315a3-283b-40ef-8719-bddace9d5fac` (Wisconsin vs High Point)
- `867fd15f-420c-4a51-9bdf-f362c1e3f4fd` (Ohio State vs TCU)

**No code changes are needed.** The fix is already live. Just re-resolve those two events from the admin panel.

### Steps
1. Go to the admin Events Manager
2. Find the Wisconsin vs High Point event → click **Undo** → then **Resolve** again
3. Find the Ohio State vs TCU event → click **Undo** → then **Resolve** again
4. Refresh the pool page — WISCONSIN_BADGERS and OHIO_STATE_BUCKEYES should disappear from Rich's owned teams list

