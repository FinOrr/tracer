import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_DB_PATH = path.join(process.cwd(), '.data', 'tracer.db')
const DB_PATH = process.env.TRACER_DB_PATH || process.env.KEYSTRA_DB_PATH || DEFAULT_DB_PATH

let db: DatabaseSync | null = null

export function getDb() {
  if (db) return db

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}

export function closeDbForTests() {
  db?.close()
  db = null
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK (type IN ('intent', 'requirement', 'verification', 'risk')),
      display_id  TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      UNIQUE (project_id, display_id)
    );

    CREATE TABLE IF NOT EXISTS item_versions (
      id             TEXT PRIMARY KEY,
      item_id        TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      text           TEXT NOT NULL,
      metadata       TEXT NOT NULL DEFAULT '{}',
      created_by     TEXT NOT NULL,
      created_at     TEXT NOT NULL,
      UNIQUE (item_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      from_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      to_item_id   TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      type         TEXT NOT NULL CHECK (type IN ('refines', 'verifies', 'mitigates')),
      created_at   TEXT NOT NULL,
      UNIQUE (from_item_id, to_item_id, type)
    );

    CREATE TABLE IF NOT EXISTS verification_runs (
      id                      TEXT PRIMARY KEY,
      verification_item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      requirement_version_id  TEXT NOT NULL REFERENCES item_versions(id),
      result                  TEXT NOT NULL CHECK (result IN ('pass', 'fail')),
      evidence_filename       TEXT,
      notes                   TEXT,
      run_by                  TEXT NOT NULL,
      run_at                  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id        TEXT PRIMARY KEY,
      event     TEXT NOT NULL,
      item_id   TEXT REFERENCES items(id) ON DELETE SET NULL,
      detail    TEXT NOT NULL DEFAULT '{}',
      logged_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_project     ON items(project_id);
    CREATE INDEX IF NOT EXISTS idx_versions_item     ON item_versions(item_id);
    CREATE INDEX IF NOT EXISTS idx_rels_from         ON relationships(from_item_id);
    CREATE INDEX IF NOT EXISTS idx_rels_to           ON relationships(to_item_id);
    CREATE INDEX IF NOT EXISTS idx_rels_project      ON relationships(project_id);
    CREATE INDEX IF NOT EXISTS idx_runs_verification ON verification_runs(verification_item_id);

    CREATE VIEW IF NOT EXISTS requirement_status AS
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
        WHEN NOT EXISTS (
          SELECT 1 FROM relationships r
          WHERE r.to_item_id = i.id AND r.type = 'verifies'
        ) THEN 'missing'
        WHEN NOT EXISTS (
          SELECT 1
          FROM relationships r
          JOIN verification_runs vr ON vr.verification_item_id = r.from_item_id
          WHERE r.to_item_id = i.id AND r.type = 'verifies'
        ) THEN 'stale'
        WHEN EXISTS (
          SELECT 1
          FROM relationships r
          JOIN (
            SELECT vr1.verification_item_id, vr1.requirement_version_id
            FROM verification_runs vr1
            WHERE vr1.run_at = (
              SELECT MAX(vr2.run_at)
              FROM verification_runs vr2
              WHERE vr2.verification_item_id = vr1.verification_item_id
            )
          ) lr ON lr.verification_item_id = r.from_item_id
          WHERE r.to_item_id = i.id
            AND r.type = 'verifies'
            AND lr.requirement_version_id != cv.id
        ) THEN 'stale'
        ELSE 'verified'
      END AS status
    FROM items i
    JOIN item_versions cv
      ON cv.item_id = i.id
     AND cv.version_number = (
      SELECT MAX(iv.version_number)
      FROM item_versions iv
      WHERE iv.item_id = i.id
    )
    WHERE i.type = 'requirement';

    CREATE TRIGGER IF NOT EXISTS trg_stale_propagation
    AFTER INSERT ON item_versions
    FOR EACH ROW
    WHEN (
      SELECT type FROM items WHERE id = NEW.item_id
    ) = 'requirement' AND NEW.version_number > 1
    BEGIN
      INSERT INTO audit_log (id, event, item_id, detail, logged_at)
      VALUES (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
        substr(lower(hex(randomblob(2))), 2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(lower(hex(randomblob(2))), 2) || '-' ||
        lower(hex(randomblob(6))),
        'requirement_version_bump',
        NEW.item_id,
        json_object('new_version', NEW.version_number, 'at', datetime('now')),
        datetime('now')
      );
    END;
  `)
}
