-- Fix existing pool_matchups to use correct round based on event's round_key
-- This corrects matchups that were created when events had wrong round assignments

UPDATE pool_matchups pm
SET round_id = (
  SELECT pr.id 
  FROM pool_rounds pr 
  WHERE pr.pool_id = pm.pool_id 
    AND pr.round_key = (
      SELECT e.round_key FROM events e WHERE e.id = pm.event_id
    )
)
WHERE pm.event_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = pm.event_id 
      AND e.round_key != (
        SELECT pr2.round_key FROM pool_rounds pr2 WHERE pr2.id = pm.round_id
      )
  );