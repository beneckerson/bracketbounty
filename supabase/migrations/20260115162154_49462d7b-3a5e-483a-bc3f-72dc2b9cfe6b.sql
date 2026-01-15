-- Fix current NFL Divisional games that are incorrectly showing as Wild Card
-- These games are scheduled for January 18-19, 2025 which is the Divisional Round
UPDATE events 
SET round_key = 'divisional', round_order = 2
WHERE competition_key = 'nfl_playoffs' 
  AND round_key = 'regular'
  AND start_time >= '2025-01-18'::timestamp
  AND start_time < '2025-01-27'::timestamp;