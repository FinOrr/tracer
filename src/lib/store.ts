import { randomUUID } from 'node:crypto'
import { getDb } from '@/lib/db'
import type {
  CreateIntentInput,
  CreateProjectInput,
  CreateRequirementInput,
  CreateVerificationInput,
  EditRequirementInput,
  Project,
  RequirementRow,
  SubmitRunInput,
  TraceRow,
} from '@/types'

const LOCAL_USER_ID = 'local-user'

function now() {
  return new Date().toISOString()
}

function metadata(value: unknown) {
  return JSON.stringify(value ?? {})
}

function parseMetadata<T = Record<string, string>>(value: string | null | undefined): T {
  if (!value) return {} as T
  return JSON.parse(value) as T
}

function plain<T>(row: unknown): T {
  return Object.assign({}, row) as T
}

function plainRows<T>(rows: unknown[]): T[] {
  return rows.map((row) => plain<T>(row))
}

function transaction(work: () => void) {
  const db = getDb()
  db.exec('BEGIN')
  try {
    work()
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function nextDisplayId(projectId: string, type: string, prefix: string) {
  const row = plain<{ count: number }>(getDb()
    .prepare('SELECT COUNT(*) AS count FROM items WHERE project_id = ? AND type = ?')
    .get(projectId, type))

  return `${prefix}-${String(row.count + 1).padStart(3, '0')}`
}

export function listProjects(): Project[] {
  return plainRows<Project>(getDb()
    .prepare('SELECT * FROM projects ORDER BY created_at DESC')
    .all())
}

export function createProjectRecord(input: CreateProjectInput) {
  const project = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    created_by: LOCAL_USER_ID,
    created_at: now(),
  }

  getDb()
    .prepare(`
      INSERT INTO projects (id, name, description, created_by, created_at)
      VALUES (@id, @name, @description, @created_by, @created_at)
    `)
    .run(project)

  return project
}

export function getProject(projectId: string): Project | null {
  const row = getDb()
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(projectId)
  return row ? plain<Project>(row) : null
}

export function listRequirements(projectId: string) {
  return plainRows<RequirementRow>(getDb()
    .prepare('SELECT * FROM requirement_status WHERE project_id = ? ORDER BY display_id ASC')
    .all(projectId))
}

export function listIntents(projectId: string) {
  const rows = plainRows<{ id: string; display_id: string; text: string; version_number: number }>(getDb()
    .prepare(`
      SELECT i.id, i.display_id, iv.text, iv.version_number
      FROM items i
      JOIN item_versions iv ON iv.item_id = i.id
      WHERE i.project_id = ? AND i.type = 'intent'
        AND iv.version_number = (
          SELECT MAX(version_number) FROM item_versions WHERE item_id = i.id
        )
      ORDER BY i.display_id ASC
    `)
    .all(projectId))

  return rows.map((row) => ({
    id: row.id,
    display_id: row.display_id,
    item_versions: [{ text: row.text, version_number: row.version_number }],
  }))
}

export function listRequirementIntentLinks(projectId: string): { from_item_id: string; to_item_id: string }[] {
  return plainRows<{ from_item_id: string; to_item_id: string }>(getDb()
    .prepare(`
      SELECT from_item_id, to_item_id
      FROM relationships
      WHERE project_id = ? AND type = 'refines'
    `)
    .all(projectId))
}

export function createIntentRecord(input: CreateIntentInput) {
  const db = getDb()
  const item = {
    id: randomUUID(),
    project_id: input.project_id,
    type: 'intent',
    display_id: nextDisplayId(input.project_id, 'intent', 'INT'),
    created_by: LOCAL_USER_ID,
    created_at: now(),
  }

  const version = {
    id: randomUUID(),
    item_id: item.id,
    version_number: 1,
    text: input.text,
    metadata: metadata({}),
    created_by: LOCAL_USER_ID,
    created_at: now(),
  }

  transaction(() => {
    db.prepare(`
      INSERT INTO items (id, project_id, type, display_id, created_by, created_at)
      VALUES (@id, @project_id, @type, @display_id, @created_by, @created_at)
    `).run(item)
    db.prepare(`
      INSERT INTO item_versions (id, item_id, version_number, text, metadata, created_by, created_at)
      VALUES (@id, @item_id, @version_number, @text, @metadata, @created_by, @created_at)
    `).run(version)
  })

  return item
}

export function createRequirementRecord(input: CreateRequirementInput) {
  const db = getDb()
  const item = {
    id: randomUUID(),
    project_id: input.project_id,
    type: 'requirement',
    display_id: nextDisplayId(input.project_id, 'requirement', 'REQ'),
    created_by: LOCAL_USER_ID,
    created_at: now(),
  }

  const version = {
    id: randomUUID(),
    item_id: item.id,
    version_number: 1,
    text: input.text,
    metadata: metadata({}),
    created_by: LOCAL_USER_ID,
    created_at: now(),
  }

  transaction(() => {
    db.prepare(`
      INSERT INTO items (id, project_id, type, display_id, created_by, created_at)
      VALUES (@id, @project_id, @type, @display_id, @created_by, @created_at)
    `).run(item)
    db.prepare(`
      INSERT INTO item_versions (id, item_id, version_number, text, metadata, created_by, created_at)
      VALUES (@id, @item_id, @version_number, @text, @metadata, @created_by, @created_at)
    `).run(version)

    if (input.intent_item_id) {
      db.prepare(`
        INSERT INTO relationships (id, project_id, from_item_id, to_item_id, type, created_at)
        VALUES (?, ?, ?, ?, 'refines', ?)
      `).run(randomUUID(), input.project_id, item.id, input.intent_item_id, now())
    }
  })

  return item
}

export function editRequirementRecord(input: EditRequirementInput) {
  const db = getDb()
  const latestRow = db
    .prepare('SELECT version_number FROM item_versions WHERE item_id = ? ORDER BY version_number DESC LIMIT 1')
    .get(input.item_id)
  const latest = latestRow ? plain<{ version_number: number }>(latestRow) : undefined

  const version = {
    id: randomUUID(),
    item_id: input.item_id,
    version_number: (latest?.version_number ?? 0) + 1,
    text: input.text,
    metadata: metadata({}),
    created_by: LOCAL_USER_ID,
    created_at: now(),
  }

  db.prepare(`
    INSERT INTO item_versions (id, item_id, version_number, text, metadata, created_by, created_at)
    VALUES (@id, @item_id, @version_number, @text, @metadata, @created_by, @created_at)
  `).run(version)

  const item = db.prepare('SELECT project_id FROM items WHERE id = ?').get(input.item_id)
  return item ? plain<{ project_id: string }>(item) : undefined
}

export function createVerificationRecord(input: CreateVerificationInput) {
  const db = getDb()
  const item = {
    id: randomUUID(),
    project_id: input.project_id,
    type: 'verification',
    display_id: nextDisplayId(input.project_id, 'verification', 'VER'),
    created_by: LOCAL_USER_ID,
    created_at: now(),
  }

  const version = {
    id: randomUUID(),
    item_id: item.id,
    version_number: 1,
    text: input.text,
    metadata: metadata({ method: input.method, criteria: input.criteria, setup: input.setup ?? '' }),
    created_by: LOCAL_USER_ID,
    created_at: now(),
  }

  transaction(() => {
    db.prepare(`
      INSERT INTO items (id, project_id, type, display_id, created_by, created_at)
      VALUES (@id, @project_id, @type, @display_id, @created_by, @created_at)
    `).run(item)
    db.prepare(`
      INSERT INTO item_versions (id, item_id, version_number, text, metadata, created_by, created_at)
      VALUES (@id, @item_id, @version_number, @text, @metadata, @created_by, @created_at)
    `).run(version)
    db.prepare(`
      INSERT INTO relationships (id, project_id, from_item_id, to_item_id, type, created_at)
      VALUES (?, ?, ?, ?, 'verifies', ?)
    `).run(randomUUID(), input.project_id, item.id, input.requirement_item_id, now())
  })

  return {
    ...item,
    text: input.text,
    method: input.method,
    criteria: input.criteria,
    setup: input.setup ?? null,
    last_run: null,
  }
}

export function submitVerificationRunRecord(input: SubmitRunInput) {
  const run = {
    id: randomUUID(),
    verification_item_id: input.verification_item_id,
    requirement_version_id: input.requirement_version_id,
    result: input.result,
    evidence_filename: input.evidence_filename ?? null,
    notes: input.notes ?? null,
    run_by: LOCAL_USER_ID,
    run_at: now(),
  }

  getDb().prepare(`
    INSERT INTO verification_runs (
      id, verification_item_id, requirement_version_id, result,
      evidence_filename, notes, run_by, run_at
    )
    VALUES (
      @id, @verification_item_id, @requirement_version_id, @result,
      @evidence_filename, @notes, @run_by, @run_at
    )
  `).run(run)

  const relRow = getDb()
    .prepare(`
      SELECT project_id FROM relationships
      WHERE from_item_id = ? AND type = 'verifies'
      LIMIT 1
    `)
    .get(input.verification_item_id)
  const rel = relRow ? plain<{ project_id: string }>(relRow) : undefined

  return { run, project_id: rel?.project_id }
}

export function getTraceMatrix(projectId: string): TraceRow[] {
  const reqs = listRequirements(projectId)

  return reqs.map((req) => {
    const verRelRow = getDb()
      .prepare(`
        SELECT from_item_id FROM relationships
        WHERE to_item_id = ? AND type = 'verifies'
        LIMIT 1
      `)
      .get(req.id)
    const verRel = verRelRow ? plain<{ from_item_id: string }>(verRelRow) : undefined

    if (!verRel) return { req, verification: null, run: null }

    const verVersionRow = getDb()
      .prepare(`
        SELECT iv.text, iv.metadata, iv.item_id, i.display_id
        FROM item_versions iv
        JOIN items i ON i.id = iv.item_id
        WHERE iv.item_id = ?
        ORDER BY iv.version_number DESC
        LIMIT 1
      `)
      .get(verRel.from_item_id)
    const verVersion = verVersionRow
      ? plain<{ text: string; metadata: string; item_id: string; display_id: string }>(verVersionRow)
      : undefined

    const runRow = getDb()
      .prepare(`
        SELECT * FROM verification_runs
        WHERE verification_item_id = ?
        ORDER BY run_at DESC
        LIMIT 1
      `)
      .get(verRel.from_item_id)
    const run = runRow ? plain<NonNullable<TraceRow['run']>>(runRow) : null

    const meta = parseMetadata(verVersion?.metadata)

    return {
      req,
      verification: verVersion
        ? {
            id: verRel.from_item_id,
            display_id: verVersion.display_id,
            method: meta.method ?? '',
            criteria: meta.criteria ?? '',
          }
        : null,
      run: run ?? null,
    }
  })
}

export function loadRequirementDetail(itemId: string) {
  const reqRow = getDb()
    .prepare('SELECT * FROM requirement_status WHERE id = ?')
    .get(itemId)
  const req = reqRow ? plain<RequirementRow>(reqRow) : undefined

  if (!req) return null

  const intentRelRow = getDb()
    .prepare(`
      SELECT to_item_id FROM relationships
      WHERE from_item_id = ? AND type = 'refines'
      LIMIT 1
    `)
    .get(itemId)
  const intentRel = intentRelRow ? plain<{ to_item_id: string }>(intentRelRow) : undefined

  let intent = null
  if (intentRel) {
    const rawRow = getDb()
      .prepare(`
        SELECT iv.text, iv.item_id, i.display_id
        FROM item_versions iv
        JOIN items i ON i.id = iv.item_id
        WHERE iv.item_id = ?
        ORDER BY iv.version_number DESC
        LIMIT 1
      `)
      .get(intentRel.to_item_id)
    const row = rawRow ? plain<{ text: string; item_id: string; display_id: string }>(rawRow) : undefined

    if (row) intent = { id: intentRel.to_item_id, display_id: row.display_id, text: row.text }
  }

  const verRelRow = getDb()
    .prepare(`
      SELECT from_item_id FROM relationships
      WHERE to_item_id = ? AND type = 'verifies'
      LIMIT 1
    `)
    .get(itemId)
  const verRel = verRelRow ? plain<{ from_item_id: string }>(verRelRow) : undefined

  let verification = null
  if (verRel) {
    const rawRow = getDb()
      .prepare(`
        SELECT iv.text, iv.metadata, iv.item_id, i.display_id
        FROM item_versions iv
        JOIN items i ON i.id = iv.item_id
        WHERE iv.item_id = ?
        ORDER BY iv.version_number DESC
        LIMIT 1
      `)
      .get(verRel.from_item_id)
    const row = rawRow
      ? plain<{ text: string; metadata: string; item_id: string; display_id: string }>(rawRow)
      : undefined

    const runRow = getDb()
      .prepare(`
        SELECT * FROM verification_runs
        WHERE verification_item_id = ?
        ORDER BY run_at DESC
        LIMIT 1
      `)
      .get(verRel.from_item_id)
    const run = runRow ? plain(runRow) : null

    if (row) {
      const meta = parseMetadata(row.metadata)
      verification = {
        id: verRel.from_item_id,
        display_id: row.display_id,
        text: row.text,
        method: meta.method ?? '',
        criteria: meta.criteria ?? '',
        setup: meta.setup ?? null,
        last_run: run ?? null,
      }
    }
  }

  return { req, intent, verification }
}
