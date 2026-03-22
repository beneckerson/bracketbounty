

## Plan: Clean Up Round of 32 Orphaned Teams

### Problem
Two Round of 32 matchups were resolved before the CAPTURED elimination fix was deployed, leaving two teams incorrectly active in ownership.

### Data Fix
Single migration to delete the two orphaned ownership records:

1. **Aids → TCU_HORNED_FROGS**: Duke beat TCU 81-58 (ADVANCES). TCU was eliminated from the tournament but ownership record remains.
2. **beneckerson → HIGH_POINT_PANTHERS**: Arkansas beat High Point 94-88 (CAPTURED — High Point covered +11.5 but lost). Ben correctly captured Arkansas, but his original High Point team lost the game and should have been eliminated.

### Changes
**One migration** — delete these two ownership rows:
```sql
DELETE FROM public.ownership 
WHERE pool_id = '6797a523-c571-4138-8882-80811702490e' 
AND (
  (member_id = 'c1e3ba69-791e-4b5b-851b-3f410ba51929' AND team_code = 'TCU_HORNED_FROGS')
  OR (member_id = 'dd04f58f-bbe6-466d-8459-e7bc8a30ff16' AND team_code = 'HIGH_POINT_PANTHERS')
);
```

No code changes needed — the edge function fix already handles this for future resolutions.

