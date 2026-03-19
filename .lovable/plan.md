
Goal: fix the blocked “Create Pool” action first, then add admin quality-control overrides for team name/abbreviation/color so bad imports can be corrected safely.

What I found from the current code:
- `CreatePool` can fail silently at submit time because `handleSubmit` has no invalid callback and several validated fields are hidden (`selectedTeams`, `teamsPerPlayer`, `competitionKey`), so users can click “Create Pool” and see no actionable error.
- Create flow currently surfaces only a generic failure toast on backend errors, which hides the real cause.
- Team metadata quality can degrade from admin ingestion paths:
  - `RosterEditor.addManualTeam()` writes `abbreviation: code` (UPPER_SNAKE_CASE).
  - `EventsManager` create/edit upserts teams with `abbreviation: CODE`.
- There is no admin UI to override/fix incorrect team display metadata.
- Admin roster color swatches still use raw `team.color` as CSS color in places, which is incorrect for token values like `team-orange`.

Implementation plan:

1) Make Create Pool failure explicit and debuggable (highest priority)
- Update `src/pages/CreatePool.tsx` submit flow:
  - Replace direct `form.handleSubmit(onSubmit)()` click with a wrapper that runs `form.trigger()` first.
  - Add invalid-submit handler to show a clear toast with first blocking field/error.
  - Recompute `teamsPerPlayer` immediately before submit from selected teams/player count.
  - Disable or block submit with clear messaging when required hidden fields are invalid.
- Improve backend error visibility:
  - In catch block, include real error message (when safe) so “nothing happens” becomes actionable.

2) Tighten step validation before reaching Review
- In `CreatePool.tsx`, validate step-specific requirements on Continue (especially player/team math) so users don’t reach Review with invalid hidden state.
- Add a compact “preflight” warning panel on Review listing unresolved validation issues.

3) Add admin override controls for team metadata (name/abbreviation/color)
- Extend `src/components/admin/RosterEditor.tsx`:
  - Add per-team “Edit” action/dialog with fields:
    - Display name
    - Abbreviation
    - Color token (team palette)
  - Save directly to `teams` table (admin-only via existing RLS).
  - Refresh local roster/teams state after save.
- Keep overrides on the roster-admin surface (as requested), not buried elsewhere.

4) Prevent future bad team metadata at ingestion points
- Update admin creation/import paths to stop writing abbreviations as raw codes:
  - `RosterEditor.addManualTeam()`
  - `EventsManager` manual create/edit team upserts
  - `NCAAGameSelector` abbreviation derivation path
- Standardize on a shared helper for:
  - `toTeamCode(name)`
  - `deriveSchoolAbbreviation(name)` (handles multi-word mascots)
  - `hashToColor(code)` fallback

5) Fix color rendering consistency in admin + pool selectors
- Add shared resolver utility for token-based colors (`team-*`) to CSS values.
- Apply to:
  - `RosterEditor` swatches (both roster rows and add-team chips)
  - Any other inline style consumers that currently pass token strings directly.
- Keep `TeamBar` token class mapping behavior for bracket pills.

6) One-time quality cleanup migration for existing bad rows
- Add a migration to normalize legacy rows where abbreviation is code-like (underscore/all-caps patterns), prioritizing school-name abbreviation derivation.
- Backfill invalid/missing colors to valid palette tokens.
- No RLS policy changes needed (existing `teams` admin policy already supports this).

7) QA and verification checklist
- Reproduce original path: create pool with March Madness setup (32/64 selected teams, 2 players) and verify Create Pool opens success dialog.
- Force invalid state and confirm submit now shows explicit reason (no silent no-op).
- In admin roster, override one team’s name/abbreviation/color and verify it reflects in:
  - Create Pool review matchups
  - Pool bracket/team pills
- Regression-check manual event/team creation to ensure no new UPPER_SNAKE abbreviations are introduced.

Technical details
- Primary files: `src/pages/CreatePool.tsx`, `src/components/admin/RosterEditor.tsx`, `src/components/admin/EventsManager.tsx`, `src/components/admin/NCAAGameSelector.tsx`, plus a new shared team-format utility and one SQL migration.
- Backend security model remains intact: team metadata edits stay admin-restricted through existing backend policies.
