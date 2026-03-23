

## Plan: Fix Stale Matchup Participants + Systemic Prevention

### Root Cause
When matchups are created (by `start-pool` or `sync-odds`), `participant_a_member_id` and `participant_b_member_id` are set based on team ownership at that moment. When a capture in Round N changes ownership of a team, the Round N+1 matchup still references the old owner. The UI uses these participant fields for avatar display, so wrong avatars appear.

### Stale Participants Found (Full Audit)

**Resolved matchups:**
1. **Kansas vs St. John's R32** (`60063ec5`): participant_a = Rich → should be **beneckerson** (Kansas captured in R64); participant_b = Wilson → should be **Rich** (St. John's)
2. **Virginia vs Tennessee R32** (`8ab88b89`): participant_a = beneckerson → should be **Kerner** (Virginia captured in R64)

**Unresolved matchups:**
3. **UConn vs UCLA R32** (`f259ad23`): participant_b = Aids → should be **B Hart** (UCLA captured in R64)
4. **Duke vs St. John's Sweet 16** (`04565f7e`): participant_b = Wilson → should be **beneckerson** (St. John's captured in R32)

### Changes

**1. Data repair migration** — Fix all 4 stale participant records:

```sql
-- Kansas vs St. John's R32
UPDATE pool_matchups SET participant_a_member_id = 'dd04f58f-...', participant_b_member_id = '2cca8527-...' WHERE id = '60063ec5-...';
-- Virginia vs Tennessee R32
UPDATE pool_matchups SET participant_a_member_id = '7b82f0ab-...' WHERE id = '8ab88b89-...';
-- UConn vs UCLA R32
UPDATE pool_matchups SET participant_b_member_id = '3a13f4a7-...' WHERE id = 'f259ad23-...';
-- Duke vs St. John's Sweet 16
UPDATE pool_matchups SET participant_b_member_id = 'dd04f58f-...' WHERE id = '04565f7e-...';
```

**2. `supabase/functions/resolve-matchup/index.ts`** — After looking up current ownership (lines 62-73), update participant fields on the matchup to reflect the actual current owners before resolving. This prevents stale avatars on all future resolutions:

```text
// After fetching homeOwner/awayOwner (line 73), add:
await supabase.from('pool_matchups').update({
  participant_a_member_id: homeOwner?.member_id || null,
  participant_b_member_id: awayOwner?.member_id || null,
}).eq('id', matchup_id);
```

This is a small addition (~5 lines) inserted after line 73 and before the spread lookup.

### Summary
- 1 migration for data repair (4 UPDATE statements)
- 1 edge function edit (~5 lines) to prevent future staleness
- No UI changes needed — the UI already reads participant fields correctly

