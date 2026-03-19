

## Plan: Show Eliminated Teams (with Capture History)

### The Problem with Captures
A team can appear in multiple owners' histories:
1. **Owner A** gets DUKE initially → loses to Owner B via capture → DUKE is "lost" for A
2. **Owner B** captures DUKE → later loses DUKE in another matchup → DUKE is "lost" for B too

Simply showing every historical owner would duplicate team pills across multiple members. We need a clear, non-confusing approach.

### Recommended UI Approach: Single "Lost" Section Per Owner

Each owner's card shows:
- **Active pills** (current ownership, as today)
- **Lost pills** — teams they no longer own, shown faded with strikethrough + a small label indicating HOW they lost it:
  - "Eliminated" (team lost the game outright, no capture)
  - "Captured" (team was taken by another owner)

This way a team like DUKE could appear as "Lost (Captured)" under Owner A and "Lost (Eliminated)" under Owner B — each owner sees their own history.

### How to Derive Lost Teams
From the resolved `pool_matchups` data already fetched:
- For each final matchup, identify the **losing member** (`participant_a/b_member_id` that is NOT `winner_member_id`)
- Identify which team(s) they lost: look at the event's `home_team`/`away_team` and match to the participant
- If the team is NOT in their current `ownership` records, it's a "lost" team
- Determine loss type: if the matchup has `decided_by` and the winning member gained the team (capture mode), it's "Captured"; otherwise "Eliminated"

### Changes

**1. `src/lib/types.ts`** — Add `lostTeams` to `PoolMember`
```typescript
lostTeams: { teamCode: string; lostVia: 'eliminated' | 'captured'; fromMatchupId?: string }[];
```

**2. `src/pages/Pool.tsx`** — Compute `lostTeams` per member
After building `ownershipByMember`, scan all final matchups to derive lost teams for each losing member. Attach to the transformed member object.

**3. `src/components/bracket/OwnedTeamsList.tsx`** — Render lost team pills
- After active pills, render `lostTeams` as faded pills with `opacity-40`, `line-through`, and a small tag ("Elim" or "Cap'd")
- A member with 0 active teams but ≥1 lost team moves to the "Eliminated" section (shown with all their lost pills)
- Members with 0 active and 0 lost teams are hidden entirely

### Visual Treatment
```text
┌─────────────────────────────┐
│ 🟢 Rich (Active Owners)    │
│  [DUKE] [UNC] [BAYLOR]     │  ← active pills (bright)
│  ̶W̶I̶S̶C̶ ̶ Elim  ̶O̶H̶I̶O̶S̶T̶ ̶ Cap'd │  ← lost pills (faded, strikethrough)
└─────────────────────────────┘
```

### No Database Changes Required
All data is already available from `pool_matchups` (participant IDs, winner) and `events` (team codes).

