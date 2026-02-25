
ALTER TABLE events ADD COLUMN feeds_into_event_id uuid REFERENCES events(id);
CREATE INDEX idx_events_feeds_into ON events(feeds_into_event_id) WHERE feeds_into_event_id IS NOT NULL;
