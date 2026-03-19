
Goal: fix the blocked "Create Pool" action first (no-op on Review → Create Pool), then harden admin team quality controls so name/abbreviation/color are consistently correct.

## Completed

### Pool creation fixes (done)
- Refactored form to canonical `handleSubmit(onValid, onInvalid)` with toast on validation errors
- Raised `maxPlayers`/`teamsPerPlayer` schema limits to 128 for March Madness
- Pool name validation: must contain at least one letter (numbers-only rejected with clear message)

### Auto-lock lines at sync time (done)
- `sync-odds` now self-heals: if `start_time <= now` and a line exists but isn't locked, it locks the existing spread instead of overwriting it with live API data
- If no prior line exists for a started game, it skips line creation (no spread to lock)
- Eliminates the 15-minute race window between `auto-lock-lines` cron runs

### Admin spread override (done)
- Added "Spread" button on pending-resolution and upcoming events in EventsManager
- Opens dialog to set home/away spread values manually
- Saves as `source: 'admin_override'` with `locked_at = now`, overriding any existing line

### Team ingestion quality (done)
- `RosterEditor.syncFromEvents` and `NCAAGameSelector` now use shared `deriveSchoolAbbreviation`/`hashToColor` helpers

## Remaining (optional)
- One-time data cleanup migration for legacy team abbreviations/colors
