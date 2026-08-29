/** Schema is embedded so the compiled server needs no extra asset copying. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS issues (
  number        INTEGER PRIMARY KEY,
  repo          TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  body          TEXT    NOT NULL DEFAULT '',
  state         TEXT    NOT NULL DEFAULT 'open',
  labels        TEXT    NOT NULL DEFAULT '[]',
  author        TEXT    NOT NULL DEFAULT '',
  url           TEXT    NOT NULL,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  synced_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id            TEXT    PRIMARY KEY,
  issue_number  INTEGER NOT NULL REFERENCES issues(number) ON DELETE CASCADE,
  session_id    TEXT,
  session_url   TEXT,
  phase         TEXT    NOT NULL DEFAULT 'queued',
  status        TEXT    NOT NULL DEFAULT 'pending',
  status_detail TEXT,
  acus          REAL    NOT NULL DEFAULT 0,
  error         TEXT,
  message_cursor TEXT,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  finished_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_issue ON runs(issue_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id) WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS run_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id        TEXT    NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  kind          TEXT    NOT NULL,
  phase         TEXT,
  message       TEXT    NOT NULL,
  source        TEXT    NOT NULL DEFAULT 'app',
  external_id   TEXT,
  created_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_events_run ON run_events(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_run_events_external ON run_events(run_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pull_requests (
  number        INTEGER PRIMARY KEY,
  repo          TEXT    NOT NULL,
  issue_number  INTEGER,
  run_id        TEXT,
  title         TEXT    NOT NULL DEFAULT '',
  url           TEXT    NOT NULL,
  state         TEXT    NOT NULL DEFAULT 'open',
  merged        INTEGER NOT NULL DEFAULT 0,
  head_sha      TEXT,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prs_issue ON pull_requests(issue_number);

CREATE TABLE IF NOT EXISTS checks (
  id            TEXT    PRIMARY KEY,
  pr_number     INTEGER NOT NULL REFERENCES pull_requests(number) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  state         TEXT    NOT NULL,
  url           TEXT,
  updated_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checks_pr ON checks(pr_number);

CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT    PRIMARY KEY,
  level         TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  body          TEXT    NOT NULL DEFAULT '',
  issue_number  INTEGER,
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key           TEXT    PRIMARY KEY,
  value         TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            TEXT    PRIMARY KEY,
  received_at   TEXT    NOT NULL
);
`;
