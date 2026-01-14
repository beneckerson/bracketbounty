-- Add selected_teams column to pools table
ALTER TABLE pools ADD COLUMN selected_teams TEXT[] DEFAULT NULL;