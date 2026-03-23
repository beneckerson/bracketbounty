

## Plan: Remove Orphaned Kansas Ownership

### Problem
Kansas lost to St. John's 65-67 in the Round of 32. Ben (beneckerson) won the matchup via CAPTURED (Kansas covered the +3.5 spread but lost the game), correctly capturing St. John's. However, Kansas — the team that lost the actual game — was never removed from Ben's ownership due to the same CAPTURED elimination bug that has now been fixed in the edge function.

### Data Fix
**One delete** — remove the orphaned Kansas ownership record:

```sql
DELETE FROM public.ownership
WHERE pool_id = '6797a523-c571-4138-8882-80811702490e'
  AND member_id = 'dd04f58f-bbe6-466d-8459-e7bc8a30ff16'
  AND team_code = 'KANSAS_JAYHAWKS';
```

No code changes needed — the edge function fix already handles this for future resolutions.

