

## Combobox Team Selector for Create Event Dialog

Replace the plain text inputs for Home Team and Away Team with combobox components (type-to-search + dropdown) that pull from the `competition_rosters` table for the current competition.

### How it works

- On dialog open, fetch teams from `competition_rosters` joined with `teams` for the current `competitionKey` + active season
- Render a combobox (using the existing `Command` component from shadcn) for each team field
- User can type to filter the list OR select from the dropdown
- If the user types a value not in the list, it's still accepted (free-form fallback) — important for the "First Four Winner" placeholder team that might not be in the roster yet

### Changes

**File: `src/components/admin/EventsManager.tsx`**
- Add state to fetch roster teams when the create dialog opens
- Replace the two `<Input>` fields (lines 760-774) with `Popover` + `Command` comboboxes that show a searchable dropdown of roster teams
- Each combobox displays `team.name` (or `team.code`) and sets the value to the team name/code
- Allow free-text entry so the admin can still type a team not yet in the roster

