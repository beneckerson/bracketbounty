

## Plan: Fix Resolve/Unresolve Ownership Bugs + Data Repair

### Three Related Bugs

**Bug 1: CAPTURED teams not eliminated** (resolve-matchup)
In CAPTURED results, the underdog covers the spread but loses the actual game. The underdog owner wins the pool matchup and correctly captures the favorite's team. However, the underdog's team — which lost the actual game — is never removed from ownership. This is why beneckerson still shows Siena (lost to Duke), JMB still shows Kennesaw St (lost to Gonzaga), etc.

**Bug 2: Unresolve doesn't restore eliminated ownership** (unresolve-event)
When un-resolving, the function deletes capture records and clears matchup fields, but never re-inserts ownership records for teams that were eliminated. This left TCU and Ohio State ownerless after un-resolving that matchup.

**Bug 3: TCU vs Ohio State stuck** (data)
Matchup `687f196b` has `decided_by: ats` and `winner_team_code: TCU` but `winner_member_id: null` — a half-resolved state from the unresolve bug.

### Changes

**1. `supabase/functions/resolve-matchup/index.ts`** — Eliminate the winning member's team when it lost the actual game

After the existing capture/elimination block (lines 205-250), add logic: in CAPTURED results, the `winner_team` (underdog) lost the actual game and must be removed from ownership. Delete the winning member's ownership of their team that lost the game.

**2. `supabase/functions/unresolve-event/index.ts`** — Restore ownership on unresolve

Before clearing each matchup, read its `matchup_resolved` audit_log entry. Based on `result_type`:
- **ADVANCES/UPSET**: Re-insert `initial` ownership for the losing member's eliminated team
- **CAPTURED**: Re-insert `initial` ownership for both the captured team (back to original owner) and the underdog team (back to winning member), since both were affected

**3. Data repair for Gambler's Anonymous pool** (`6797a523`)

Fix TCU/Ohio State:
- Re-insert ownership: Wilson → OHIO_STATE_BUCKEYES, Aids → TCU_HORNED_FROGS
- Clear matchup `687f196b` fields (decided_by, decided_at, winner_team_code on event)
- Reset event status to `scheduled`

Remove tournament-dead teams still showing as owned (all CAPTURED underdogs that lost their actual game):
- beneckerson: delete SIENA_SAINTS, CAL_BAPTIST_LANCERS
- JMB: delete KENNESAW_ST_OWLS
- Matt: delete HOWARD_BISON
- Rich: delete MCNEESE_COWBOYS
- Kerner: delete WRIGHT_ST_RAIDERS
- B Hart: delete UCF_KNIGHTS

### Technical Details

In resolve-matchup, the new elimination logic after the existing block:

```text
// After handling loser's team, check if winner's team lost the actual game
// This happens in CAPTURED: underdog covered spread but lost game
if (resultType === 'CAPTURED') {
  const winnerTeamCode = winnerMemberId === homeOwner?.member_id
    ? event?.home_team : event?.away_team;
  // Winner's team lost the actual game — eliminate it
  await supabase.from('ownership').delete()
    .eq('pool_id', pool.id)
    .eq('member_id', winnerMemberId)
    .eq('team_code', winnerTeamCode);
}
```

In unresolve-event, before clearing each matchup:
- Query `audit_log` for the `matchup_resolved` entry with that `matchup_id`
- Use payload fields (`result_type`, `winner_member_id`, team codes) to determine which ownership records to restore
- Insert `initial` ownership records for any teams that were deleted during resolution

