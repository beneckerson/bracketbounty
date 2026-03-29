-- Issue 1: Fix Ben's ownership (St. John's → Duke)
DELETE FROM ownership
WHERE pool_id = '6797a523-c571-4138-8882-80811702490e'
  AND member_id = 'dd04f58f-bbe6-466d-8459-e7bc8a30ff16'
  AND team_code = 'ST_JOHN_S_RED_STORM';

INSERT INTO ownership (pool_id, member_id, team_code, acquired_via, from_matchup_id)
VALUES (
  '6797a523-c571-4138-8882-80811702490e',
  'dd04f58f-bbe6-466d-8459-e7bc8a30ff16',
  'DUKE_BLUE_DEVILS',
  'capture',
  '04565f7e-c776-44e1-8c44-f112d5388ff4'
);

-- Issue 2: Mark Utah State vs Arizona as final
UPDATE events
SET status = 'final'
WHERE id = '1dcf232f-a9b4-45bb-8fbe-8388ea7022b2';

-- Issue 3: Bridge missing Elite Eight matchups
INSERT INTO pool_matchups (pool_id, round_id, event_id, participant_a_member_id, participant_b_member_id)
VALUES
(
  '6797a523-c571-4138-8882-80811702490e',
  '22a75fc8-bea3-4bbc-8e9b-414b4cf0508a',
  '37367037-431c-4c49-ba72-e923f3765c8d',
  'dd04f58f-bbe6-466d-8459-e7bc8a30ff16',
  '3fb6216b-2e36-4afc-960e-acff766a444e'
),
(
  '6797a523-c571-4138-8882-80811702490e',
  '22a75fc8-bea3-4bbc-8e9b-414b4cf0508a',
  '94a7b9c5-c021-43d1-a355-59b171643d95',
  'ffaf4ae6-d345-4faf-bf31-5d8e33c67cce',
  '3a13f4a7-021a-4294-80f7-4a77e32550dd'
);

-- Cleanup: Remove speculative Elite Eight events
DELETE FROM events WHERE id IN (
  'acbdd099-8202-431a-ad16-3819100d2aef',
  'd5615171-0e4d-4119-8696-1266c46ccbda',
  'e8ba3dfc-307d-4f0d-b9f9-2742bdc19ba5',
  'a7a0b7b8-dc47-474f-9c25-1f24ddb8390e',
  '48f1abd5-1b71-4d9e-8b8e-5ef12b2ba787',
  '23a11dd4-1826-4f99-95ca-b1b2f3ff89b0'
);