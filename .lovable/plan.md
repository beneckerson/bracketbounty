
Goal: fix the blocked “Create Pool” action first (no-op on Review → Create Pool), then harden admin team quality controls so name/abbreviation/color are consistently correct.

What the screenshot/code indicates:
- The DevTools “label/id” issues are accessibility warnings, not the core blocker.
- `CreatePool` still uses a custom click path (`trigger()` + manual `handleSubmit`) and a `form onSubmit={preventDefault}`, which makes failures hard to surface reliably.
- There is a schema/UI mismatch: `maxPlayers` input allows competition-specific values (up to 64 for March Madness), but Zod caps at 32.
- `onSubmit` can still silently return when `selectedCompetition` or `user` is missing.
- Admin override exists in roster editor, but ingestion consistency is incomplete (`RosterEditor.syncFromEvents` and `NCAAGameSelector` still have local/raw abbreviation paths).

Implementation plan:

1) Make Review submit deterministic (remove silent no-op path)
- Refactor `src/pages/CreatePool.tsx` to use canonical form submit:
  - `form` uses `onSubmit={form.handleSubmit(onValidSubmit, onInvalidSubmit)}`
  - Create button becomes `type="submit"` (no manual `trigger()` wrapper)
- Remove `onSubmit={(e)=>e.preventDefault()}` anti-pattern.
- Add explicit invalid handler that always surfaces:
  - persistent inline error banner near Create button
  - destructive toast with first failing field + readable message
- Add explicit guard feedback in valid submit:
  - if `!user` or `!selectedCompetition`, show error toast/banner (no silent return)

2) Fix validation contract mismatches causing hidden blocks
- Update schema in `CreatePool.tsx`:
  - raise `maxPlayers` cap to match supported competitions (or validate dynamically by selected competition)
  - adjust `teamsPerPlayer` upper bound to safe range for March Madness scenarios
- Before submit, compute and set `teamsPerPlayer` from current team/player values and validate it against schema/business rules.
- Add step-3 validation gate (players/buy-in step) so impossible values are blocked before Review.

3) Improve user-visible diagnostics on Review step
- Add compact “preflight checklist” above Create button showing pass/fail for:
  - competition selected
  - pool name present
  - players valid for competition
  - selected teams count
  - teams-per-player computable
- Disable Create button with a short reason when preflight fails, instead of allowing a no-op click.

4) Complete admin quality-control coverage (requested override flow)
- Keep current roster-level Edit dialog (name/abbreviation/color), and add stricter validation:
  - non-empty name/abbreviation
  - abbreviation length cap
  - color must be from approved token list
- Ensure all ingestion paths use shared helpers in `src/lib/team-utils.ts`:
  - `RosterEditor.syncFromEvents` (currently still `abbreviation: code`)
  - `NCAAGameSelector` replace local `toAbbreviation/hashToColor` with shared `deriveSchoolAbbreviation/hashToColor`
- Keep color rendering through shared `resolveTeamColor` anywhere inline styles are used.

5) Optional one-time data cleanup for existing bad metadata
- Add migration to normalize legacy team rows where abbreviation is code-like or mascot-only, and backfill invalid color tokens to known palette.
- Scope to affected league(s), preserving manual admin overrides when already set.

QA plan (post-implementation):
- Reproduce exact user flow: March Madness → all 4 steps → Create Pool.
- Verify one of two outcomes always occurs on click:
  - Success dialog opens with invite link, OR
  - Clear inline + toast error explains exactly what to fix.
- Test edge values:
  - high player counts, empty/edited player input, non-divisible allocations.
- Admin QA:
  - edit one team name/abbr/color in roster, confirm changes render in review matchups and team pills.
  - run event sync paths and confirm no new UPPER_SNAKE abbreviations are introduced.

Technical details:
- Primary files: `src/pages/CreatePool.tsx`, `src/components/admin/RosterEditor.tsx`, `src/components/admin/NCAAGameSelector.tsx`, `src/lib/team-utils.ts`.
- No auth model changes required.
- No RLS policy changes expected for this fix set.
