

## Plan: Remove Stale Texas Ownership from Matt

### Problem
When the Purdue vs Texas Sweet 16 matchup resolved as CAPTURED (Texas covered the spread but lost the game), the resolve function should have:
1. Given Matt ownership of Purdue (captured)
2. Removed Matt's ownership of Texas (underdog lost actual game)

Neither ownership change persisted correctly. Purdue was subsequently eliminated in the Elite Eight (Arizona 79, Purdue 64), so Purdue correctly has no ownership record. But Texas still appears in Matt's active teams, which is wrong — Texas was eliminated in the Sweet Sixteen.

### Fix
Single data operation — delete the stale ownership record:

```sql
DELETE FROM ownership
WHERE pool_id = '6797a523-c571-4138-8882-80811702490e'
  AND member_id = 'ffaf4ae6-d345-4faf-bf31-5d8e33c67cce'
  AND team_code = 'TEXAS_LONGHORNS';
```

No code changes needed. Matt will still show Arizona and Michigan (capture) as active teams, which is correct per the bracket state.

