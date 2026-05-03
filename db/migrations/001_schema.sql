-- ============================================================
-- TRACER , Initial Schema
-- ============================================================

-- Enums 
CREATE TYPE item_type AS ENUM (
  'intent',
  'requirement',
  'verification',
  'risk'
);

CREATE TYPE relationship_type AS ENUM (
  'refines',
  'verifies',
  'mitigates'
);

CREATE TYPE run_result AS ENUM (
  'pass',
  'fail'
);

-- Tables
CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type        item_type NOT NULL,
  display_id  text NOT NULL,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, display_id)
);

CREATE TABLE item_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  text           text NOT NULL,
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version_number)
);

CREATE TABLE relationships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  to_item_id   uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  type         relationship_type NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_item_id, to_item_id, type)
);

CREATE TABLE verification_runs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_item_id    uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  requirement_version_id  uuid NOT NULL REFERENCES item_versions(id),
  result                  run_result NOT NULL,
  evidence_filename       text,
  notes                   text,
  run_by                  uuid NOT NULL REFERENCES auth.users(id),
  run_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event     text NOT NULL,
  item_id   uuid REFERENCES items(id) ON DELETE SET NULL,
  detail    jsonb NOT NULL DEFAULT '{}',
  logged_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_items_project     ON items(project_id);
CREATE INDEX idx_versions_item     ON item_versions(item_id);
CREATE INDEX idx_rels_from         ON relationships(from_item_id);
CREATE INDEX idx_rels_to           ON relationships(to_item_id);
CREATE INDEX idx_rels_project      ON relationships(project_id);
CREATE INDEX idx_runs_verification ON verification_runs(verification_item_id);

-- Computed status view 
-- The UI reads from this. Status is never stored , always derived.
CREATE OR REPLACE VIEW requirement_status AS
SELECT
  i.id,
  i.project_id,
  i.display_id,
  i.created_by,
  cv.id             AS current_version_id,
  cv.version_number AS current_version,
  cv.text           AS current_text,
  cv.created_at     AS last_edited_at,

  CASE
    -- No verification linked at all → missing
    WHEN NOT EXISTS (
      SELECT 1 FROM relationships r
      WHERE r.to_item_id = i.id AND r.type = 'verifies'
    ) THEN 'missing'

    -- Verification linked but never been run → stale
    WHEN NOT EXISTS (
      SELECT 1
      FROM relationships r
      JOIN verification_runs vr ON vr.verification_item_id = r.from_item_id
      WHERE r.to_item_id = i.id AND r.type = 'verifies'
    ) THEN 'stale'

    -- Verification exists but latest run was against an older version → stale
    WHEN EXISTS (
      SELECT 1
      FROM relationships r
      JOIN (
        SELECT DISTINCT ON (verification_item_id)
          verification_item_id,
          requirement_version_id
        FROM verification_runs
        ORDER BY verification_item_id, run_at DESC
      ) lr ON lr.verification_item_id = r.from_item_id
      WHERE r.to_item_id = i.id
        AND r.type = 'verifies'
        AND lr.requirement_version_id != cv.id
    ) THEN 'stale'

    -- Latest run was against current version → verified
    ELSE 'verified'
  END AS status

FROM items i
JOIN LATERAL (
  SELECT * FROM item_versions iv
  WHERE iv.item_id = i.id
  ORDER BY iv.version_number DESC
  LIMIT 1
) cv ON TRUE
WHERE i.type = 'requirement';

-- Stale propagation trigger 
-- When a requirement gets a new version, log it.
-- Status becomes 'stale' automatically via the view , nothing to write.
CREATE OR REPLACE FUNCTION propagate_stale()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT type FROM items WHERE id = NEW.item_id
  ) = 'requirement' AND NEW.version_number > 1 THEN
    INSERT INTO audit_log (event, item_id, detail)
    VALUES (
      'requirement_version_bump',
      NEW.item_id,
      jsonb_build_object('new_version', NEW.version_number, 'at', now())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_stale_propagation
AFTER INSERT ON item_versions
FOR EACH ROW EXECUTE FUNCTION propagate_stale();

-- Row-Level Security 
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;

-- Projects: owner only
CREATE POLICY "owner" ON projects
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Items: accessible via project ownership
CREATE POLICY "project owner" ON items
  USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

CREATE POLICY "project owner insert" ON items
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

-- Item versions: follow item ownership
CREATE POLICY "item owner" ON item_versions
  USING (item_id IN (SELECT id FROM items WHERE project_id IN (
    SELECT id FROM projects WHERE created_by = auth.uid()
  )));

CREATE POLICY "item owner insert" ON item_versions
  WITH CHECK (item_id IN (SELECT id FROM items WHERE project_id IN (
    SELECT id FROM projects WHERE created_by = auth.uid()
  )));

-- Relationships: scoped to project
CREATE POLICY "project owner" ON relationships
  USING (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

CREATE POLICY "project owner insert" ON relationships
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()));

-- Verification runs: follow verification item ownership
CREATE POLICY "run owner" ON verification_runs
  USING (verification_item_id IN (SELECT id FROM items WHERE project_id IN (
    SELECT id FROM projects WHERE created_by = auth.uid()
  )));

CREATE POLICY "run owner insert" ON verification_runs
  WITH CHECK (verification_item_id IN (SELECT id FROM items WHERE project_id IN (
    SELECT id FROM projects WHERE created_by = auth.uid()
  )));
