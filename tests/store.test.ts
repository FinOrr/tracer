import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-store-'))
process.env.TRACER_DB_PATH = path.join(tempDir, 'tracer.db')

let store: typeof import('../src/lib/store')
let closeDbForTests: typeof import('../src/lib/db').closeDbForTests

before(async () => {
  store = await import('../src/lib/store')
  ;({ closeDbForTests } = await import('../src/lib/db'))
})

after(() => {
  closeDbForTests()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

test('creates and lists projects', () => {
  const project = store.createProjectRecord({
    name: 'Flight Controller',
    description: 'Local test project',
  })

  assert.equal(project.name, 'Flight Controller')
  assert.equal(project.description, 'Local test project')
  assert.equal(store.getProject(project.id)?.id, project.id)
  assert.deepEqual(store.listProjects().map((p) => p.id), [project.id])
})

test('tracks requirement links and verification status lifecycle', () => {
  const project = store.createProjectRecord({ name: 'Sensor Module' })
  const intent = store.createIntentRecord({
    project_id: project.id,
    text: 'As a technician, I need fast startup.',
  })
  const requirement = store.createRequirementRecord({
    project_id: project.id,
    intent_item_id: intent.id,
    text: 'The device SHALL start within 5 seconds.',
  })

  assert.equal(store.listIntents(project.id)[0].display_id, 'INT-001')
  assert.deepEqual(store.listRequirementIntentLinks(project.id), [
    { from_item_id: requirement.id, to_item_id: intent.id },
  ])

  let [status] = store.listRequirements(project.id)
  assert.equal(status.display_id, 'REQ-001')
  assert.equal(status.status, 'missing')

  const verification = store.createVerificationRecord({
    project_id: project.id,
    requirement_item_id: requirement.id,
    text: 'Measure startup time from power-on to ready.',
    method: 'Bench measurement',
    criteria: 'Ready signal under 5000 ms',
  })

  ;[status] = store.listRequirements(project.id)
  assert.equal(status.status, 'stale')

  store.submitVerificationRunRecord({
    verification_item_id: verification.id,
    requirement_version_id: status.current_version_id,
    result: 'pass',
    evidence_filename: 'startup.log',
  })

  ;[status] = store.listRequirements(project.id)
  assert.equal(status.status, 'verified')

  store.editRequirementRecord({
    item_id: requirement.id,
    text: 'The device SHALL start within 4 seconds.',
  })

  ;[status] = store.listRequirements(project.id)
  assert.equal(status.current_version, 2)
  assert.equal(status.status, 'stale')

  const detail = store.loadRequirementDetail(requirement.id)
  assert.equal(detail?.intent?.display_id, 'INT-001')
  assert.equal(detail?.verification?.display_id, 'VER-001')
  assert.equal(detail?.verification?.last_run?.evidence_filename, 'startup.log')

  const [traceRow] = store.getTraceMatrix(project.id)
  assert.equal(traceRow.verification?.criteria, 'Ready signal under 5000 ms')
  assert.equal(traceRow.run?.result, 'pass')
})
