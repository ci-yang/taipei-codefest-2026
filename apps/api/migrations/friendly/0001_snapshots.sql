-- Append-only versions: a complete snapshot becomes visible in one SQL statement.
CREATE TABLE IF NOT EXISTS friendly_snapshots (
  version TEXT PRIMARY KEY NOT NULL,
  stores_json TEXT NOT NULL CHECK (json_valid(stores_json)),
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64)
);
CREATE TRIGGER IF NOT EXISTS friendly_snapshots_no_update
BEFORE UPDATE ON friendly_snapshots
BEGIN
  SELECT RAISE(ABORT, 'friendly snapshots are immutable');
END;
CREATE TRIGGER IF NOT EXISTS friendly_snapshots_no_delete
BEFORE DELETE ON friendly_snapshots
BEGIN
  SELECT RAISE(ABORT, 'friendly snapshots are immutable');
END;
