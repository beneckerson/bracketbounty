

## Plan: Fix Furman/UConn Orphaned Ownership + Verify Nebraska

### Root Cause

The same CAPTURED elimination bug, but for a **self-matchup** (Wilson owned both UConn and Furman in the R64). When Furman covered the spread but lost the actual game:
- Wilson correctly "captured" UConn from himself (no net change in UConn ownership)
- But Furman (the underdog that lost the game) was never eliminated from ownership

Additionally, the capture record for UConn was never created — so UConn has **no owner at all**, which is why the R32 UConn vs UCLA matchup shows a "?" avatar.

### Nebraska Status

Nebraska is **correctly active**. It won its R32 game against Vanderbilt 74-72. There is no subsequent event in the system where Nebraska has been eliminated. If Nebraska lost in real life since then, it would need a new event entered and resolved.

### Data Fix

**One migration** with two operations:

1. **Delete** `FURMAN_PALADINS` from Wilson (`3fb6216b`) — eliminated in R64 (lost to UConn 71-82)
2. **Insert** `UCONN_HUSKIES` for Wilson (`3fb6216b`) with `acquired_via: 'capture'`, `from_matchup_id: 'b833134c'` — this restores the capture record that should have been created during resolution

This will fix the "?" avatar on the UConn vs UCLA R32 matchup card, since UConn will now be properly owned by Wilson.

### No Code Changes Needed

The edge function fix from the previous plan already handles CAPTURED elimination for future resolutions. This is purely a data repair for a matchup resolved before the fix was deployed.

