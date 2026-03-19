

## Plan: Sort Matchups by Status and Game Time

### What changes
**File: `src/components/bracket/BracketView.tsx`**

Add a `useMemo` that sorts the active round's matchups before rendering:

1. **Final/resolved games first** — so completed scores are immediately visible at the top
2. **Live games next** — actively in progress
3. **Upcoming games last** — sorted by `startTime` ascending (earliest tip-off first)

This is a single change (~15 lines) in `BracketView.tsx`. After line 66 where `activeRound` is computed, we add a `sortedMatchups` memo that applies the sort order, then use `sortedMatchups` in the render loop instead of `activeRound?.matchups`.

### Sort priority
```text
1. final     (resolved)
2. live      (in progress)
3. upcoming  (sorted by startTime, soonest first)
```

No backend or schema changes needed.

