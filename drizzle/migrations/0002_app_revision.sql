CREATE TABLE IF NOT EXISTS app_revisions (
  id varchar(32) PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_revisions(id, revision) VALUES ('main', 0) ON CONFLICT (id) DO NOTHING;
