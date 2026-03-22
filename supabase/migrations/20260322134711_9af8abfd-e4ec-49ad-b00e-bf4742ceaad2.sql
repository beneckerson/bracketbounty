-- Restore ownership for TCU/Ohio State matchup
INSERT INTO public.ownership (pool_id, member_id, team_code, acquired_via)
VALUES 
  ('6797a523-c571-4138-8882-80811702490e', '3fb6216b-2e36-4afc-960e-acff766a444e', 'OHIO_STATE_BUCKEYES', 'initial'),
  ('6797a523-c571-4138-8882-80811702490e', 'c1e3ba69-791e-4b5b-851b-3f410ba51929', 'TCU_HORNED_FROGS', 'initial')
ON CONFLICT (pool_id, member_id, team_code) DO NOTHING;

-- Remove tournament-dead teams (CAPTURED underdogs whose teams lost the actual game)
DELETE FROM public.ownership 
WHERE pool_id = '6797a523-c571-4138-8882-80811702490e' 
AND (
  (member_id = 'dd04f58f-bbe6-466d-8459-e7bc8a30ff16' AND team_code IN ('SIENA_SAINTS', 'CAL_BAPTIST_LANCERS'))
  OR (member_id = '4c6fe963-046f-45e0-be80-861309ab7900' AND team_code = 'KENNESAW_ST_OWLS')
  OR (member_id = 'ffaf4ae6-d345-4faf-bf31-5d8e33c67cce' AND team_code = 'HOWARD_BISON')
  OR (member_id = '2cca8527-2cb6-4c56-8415-d560df3587bd' AND team_code = 'MCNEESE_COWBOYS')
  OR (member_id = '7b82f0ab-6625-4901-b74f-cd9110687c64' AND team_code = 'WRIGHT_ST_RAIDERS')
  OR (member_id = '3a13f4a7-021a-4294-80f7-4a77e32550dd' AND team_code = 'UCF_KNIGHTS')
);

-- Reset the stuck TCU/Ohio State matchup
UPDATE public.pool_matchups 
SET winner_member_id = NULL, decided_by = NULL, decided_at = NULL, commissioner_note = NULL
WHERE id = '687f196b-e8eb-48dc-9ee6-6c00e63187df';

-- Reset the event back to scheduled
UPDATE public.events
SET status = 'scheduled', final_home_score = NULL, final_away_score = NULL, winner_team_code = NULL
WHERE id = '867fd15f-420c-4a51-9bdf-f362c1e3f4fd';