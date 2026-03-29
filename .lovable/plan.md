

## Plan: Eliminate Speculative Matchups (Root Cause Fix)

### Problem
The previous fix (requiring both teams to have active ownership) is necessary but insufficient. The Odds API publishes odds for **every possible pairing** in future rounds (e.g., 8 different Elite Eight matchups when only 4 will actually happen). Both teams in these speculative matchups ARE actively owned — they just haven't actually been confirmed to play each other yet. The pool currently has:
- **8 phantom Elite Eight matchups** (e.g., Tennessee vs Michigan, Iowa State vs Michigan, Alabama vs Iowa State, etc.)
- **1 phantom Sweet Sixteen matchup** (Iowa vs Illinois duplicate)

### Root Cause
`sync-odds` checks if both teams have active owners, but does NOT check whether those teams still have unresolved matchups in earlier rounds. If Team A is playing in the Sweet Sixteen right now, the API already publishes Team A's potential Elite Eight opponents — and the bridge creates all of them.

### Changes

**1. `supabase/functions/sync-odds/index.ts`** — Add a "prior-round check" to the bridge (after line 542):

Before creating a pool_matchup, query for any unresolved matchups in the same pool where either team appears in a round with a lower `round_order`. If found, skip — the matchup is speculative.

```text
// After the ownership check (line 542), add:
// Check if either team has an unresolved matchup in an earlier round
const { data: unresolvedPrior } = await supabase
  .from('pool_matchups')
  .select('id, round:pool_rounds!inner(round_order)')
  .eq('pool_id', pool.id)
  .is('winner_member_id', null)
  .or(`event.home_team.eq.${upsertedEvent.home_team},event.away_team.eq.${upsertedEvent.home_team},event.home_team.eq.${upsertedEvent.away_team},event.away_team.eq.${upsertedEvent.away_team}`)
  // Only matchups in rounds before this one
  .lt('pool_rounds.round_order', roundInfo.round_order);

if (unresolvedPrior && unresolvedPrior.length > 0) {
  console.log(`Skipping pool ${pool.id}: team(s) have unresolved prior-round matchups`);
  continue;
}
```

Since the Supabase JS client may not support nested `.or()` with joined table filters cleanly, the implementation will use a raw query approach or two separate existence checks for home_team and away_team against existing pool_matchups joined to events.

**2. `supabase/functions/start-pool/index.ts`** — Add the same prior-round guard at pool start (line 298-323):

The `start-pool` function also creates matchups from all matching events. If the Odds API has already populated speculative future-round events, `start-pool` will link them all. Add the same check: only create a matchup if neither team has a matchup in an earlier round that is still unresolved.

For pool start this is simpler since all matchups start unresolved — just skip events whose `round_order` > 1 if either team already appears in a lower-round event being inserted.

**3. Data cleanup** — Delete the 9 speculative matchups from the Gambler's Anonymous pool:

```sql
DELETE FROM pool_matchups WHERE id IN (
  '67e8139a-53cf-476e-bb17-dd768a7ba5fd',  -- Tennessee vs Michigan (E8)
  'a99d0975-8a84-499b-9c5b-a1e759bc2a4d',  -- Alabama vs Iowa State (E8)
  '2593341e-7a59-483b-a81b-fe8d6b755bfa',  -- Iowa State vs Michigan (E8)
  'd57cd282-dd83-4095-abfa-4f7108795633',  -- Tennessee vs Alabama (E8)
  '27ad511a-b9a4-4496-acf7-df0562b13499',  -- St. John's vs UConn (E8)
  'e2693ab3-e081-4622-899a-13c900636abf',  -- St. John's vs Michigan St (E8)
  '2e805d07-a003-4fbb-a678-e4d91fd4e8ab',  -- Michigan St vs Duke (E8)
  'fb144357-bd6f-4628-9d1a-caca2523383b',  -- UConn vs Duke (E8)
  '30210c67-6d74-4ff8-816d-63af48d42df0'   -- Iowa vs Illinois (S16 dupe)
);
```

Also delete the speculative events that only exist to serve these phantom matchups (Texas speculative Sweet Sixteen events):
```sql
DELETE FROM events WHERE id IN (
  '166eb399-880d-4048-a14b-c2a62ef711fe',  -- Texas vs Arizona (speculative S16)
  'd57ce94d-f775-42d0-84e7-9cd7eeeddcf2'   -- Texas vs Arkansas (speculative S16)
);
```

### Summary
- 1 edge function edit (`sync-odds` bridge: ~15 lines added for prior-round check)
- 1 edge function edit (`start-pool`: ~10 lines added for same guard)
- Data cleanup: delete 9 speculative matchups + 2 speculative events

