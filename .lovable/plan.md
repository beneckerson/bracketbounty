

## Fix: Auto-seed `march_madness` Season

The dropdown is empty because the `competition_seasons` table has rows for `cfp`, `nfl_playoffs`, `nba_playoffs`, `nhl_playoffs`, and `mlb_playoffs` — but none for `march_madness`. This was an oversight when adding the new competition.

### What needs to happen

Insert a single row into `competition_seasons`:

```sql
INSERT INTO competition_seasons (competition_key, season, is_active)
VALUES ('march_madness', '2025-2026', true);
```

That's it. After this, selecting "NCAA Tournament" in the admin Rosters page will show "2025-2026 (Active)" in the season dropdown, and the Teams/Events/Game Selector tabs will appear.

### Files changed
None — this is a data insert only.

