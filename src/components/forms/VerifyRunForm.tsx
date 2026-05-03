'use client'
// src/components/forms/VerifyRunForm.tsx
// Defines and runs a verification.
// Criteria placeholder and method guidance adapts to the requirement's keyword.

import { useState, useTransition } from 'react'
import { createVerification, submitVerificationRun } from '@/lib/actions'
import { KEYWORD_META, type RequirementKeyword } from '@/types'
import styles from './Form.module.css'

// Detect keyword from requirement text , used to surface relevant guidance
function detectKeyword(text: string): RequirementKeyword {
  if (text.includes('SHALL NOT')) return 'SHALL NOT'
  if (text.includes('SHALL'))     return 'SHALL'
  if (text.includes('SHOULD NOT'))return 'SHOULD NOT'
  if (text.includes('SHOULD'))    return 'SHOULD'
  if (text.includes('MAY'))       return 'MAY'
  return 'SHALL' // safe default
}

const METHOD_OPTIONS = [
  'Automated test',
  'Manual test',
  'Bench measurement',
  'Analysis',
  'Inspection',
  'Review',
]

interface Props {
  projectId:             string
  requirement:           any
  verification:          any | null
  onCancel:              () => void
  onSaved:               (run: { result: 'pass' | 'fail'; evidence_filename: string | null; notes: string | null; run_at: string }) => void
  onVerificationCreated: (ver: any) => void
}

export function VerifyRunForm({ projectId, requirement, verification, onCancel, onSaved, onVerificationCreated }: Props) {
  const keyword    = detectKeyword(requirement.current_text)
  const kwMeta     = KEYWORD_META[keyword]
  const isOptional = keyword === 'MAY'

  const [step, setStep]     = useState<'define' | 'run'>(verification ? 'run' : 'define')
  const [isPending, start]  = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [createdVer, setCreatedVer] = useState<any | null>(verification)

  // Define fields
  const [verText, setVerText] = useState('')
  const [method, setMethod]   = useState('Automated test')
  const [criteria, setCriteria] = useState('')
  const [setup, setSetup]     = useState('')

  // Run fields
  const [result, setResult]   = useState<'pass' | 'fail' | null>(null)
  const [evidence, setEvidence] = useState('')
  const [notes, setNotes]     = useState('')

  async function handleDefine(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      try {
        const ver = await createVerification({
          project_id: projectId, requirement_item_id: requirement.id,
          text: verText.trim(), method: method.trim(),
          criteria: criteria.trim(), setup: setup.trim() || undefined,
        })
        setCreatedVer(ver)
        setStep('run')
        onVerificationCreated(ver)
      } catch (e: any) { setError(e.message) }
    })
  }

  async function handleRun(e: React.FormEvent) {
    e.preventDefault()
    if (!result || !createdVer) return
    setError(null)
    start(async () => {
      try {
        await submitVerificationRun({
          verification_item_id:   createdVer.id,
          requirement_version_id: requirement.current_version_id,
          result, evidence_filename: evidence.trim() || undefined,
          notes: notes.trim() || undefined,
        })
        onSaved({
          result:            result!,
          evidence_filename: evidence.trim() || null,
          notes:             notes.trim()    || null,
          run_at:            new Date().toISOString(),
        })
      } catch (e: any) { setError(e.message) }
    })
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.heading}>
          {step === 'define' ? 'Add verification' : 'Record result'}
        </div>
        <div className={styles.sub}>
          {requirement.display_id} · {requirement.current_text.slice(0, 65)}…
        </div>
      </div>

      {/*  Keyword context banner  */}
      <div className={styles.kwBanner} style={{ borderLeftColor: kwMeta.color }}>
        <span className={styles.kwBannerPill} style={{ background: `${kwMeta.color}18`, color: kwMeta.color }}>
          {keyword}
        </span>
        <span className={styles.kwBannerText}>
          {keyword === 'SHALL' || keyword === 'SHALL NOT'
            ? 'Formal verification required. Pass/fail result must be documented.'
            : keyword === 'SHOULD' || keyword === 'SHOULD NOT'
            ? 'Verification recommended. If waived, document the justification in notes.'
            : 'Optional. Verify if implemented , no test is strictly required.'}
        </span>
      </div>

      {/*  Define step  */}
      {step === 'define' && (
        <form onSubmit={handleDefine} className={styles.form}>

          <div className={styles.field}>
            <label className={styles.label}>What is being tested <span className={styles.required}>*</span></label>
            <textarea
              className={styles.textarea}
              value={verText}
              onChange={e => setVerText(e.target.value)}
              placeholder={
                keyword === 'SHALL NOT'
                  ? 'e.g. Confirm the device cannot transmit on restricted channels under any condition.'
                  : 'e.g. Measure BLE connection time from power-on to GATT connection established.'
              }
              rows={3}
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Method <span className={styles.required}>*</span></label>
            <select className={styles.select} value={method} onChange={e => setMethod(e.target.value)}>
              {METHOD_OPTIONS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Pass criteria <span className={styles.required}>*</span></label>
            <input
              className={styles.input}
              value={criteria}
              onChange={e => setCriteria(e.target.value)}
              placeholder={
                keyword === 'SHALL NOT'
                  ? 'e.g. No transmission observed on channels 36–39 across 100 attempts'
                  : keyword === 'MAY'
                  ? 'e.g. Feature activates correctly when enabled , no errors in log'
                  : 'e.g. T_conn < 5000 ms over 5 consecutive runs'
              }
              required
            />
            <div className={styles.hint}>
              {keyword === 'SHALL' || keyword === 'SHALL NOT'
                ? 'Must be unambiguous and measurable.'
                : keyword === 'SHOULD' || keyword === 'SHOULD NOT'
                ? 'Define the expected outcome. Note acceptable deviation if relevant.'
                : 'Define the expected outcome for this optional capability.'}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Test setup <span className={styles.optional}>(optional)</span></label>
            <input
              className={styles.input}
              value={setup}
              onChange={e => setSetup(e.target.value)}
              placeholder="e.g. nRF52840 DK · Channel 37 · signal −70 dBm · 3 runs averaged"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={onCancel}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}
              disabled={isPending || !verText.trim() || !criteria.trim()}>
              {isPending ? 'Saving…' : 'Save & run'}
            </button>
          </div>
        </form>
      )}

      {/*  Run step  */}
      {step === 'run' && (
        <form onSubmit={handleRun} className={styles.form}>

          {createdVer && (
            <div className={styles.specCard}>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Criteria</span>
                <span className={styles.specValue}>{createdVer.criteria ?? criteria}</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Method</span>
                <span className={styles.specValue}>{createdVer.method ?? method}</span>
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Result <span className={styles.required}>*</span></label>
            <div className={styles.resultChoices}>
              {(['pass', 'fail'] as const).map(r => (
                <button key={r} type="button"
                  className={`${styles.resultChoice} ${result === r ? (r === 'pass' ? styles.choicePass : styles.choiceFail) : ''}`}
                  onClick={() => setResult(r)}
                >
                  <div className={styles.resultIcon}>{r === 'pass' ? '✓' : '✕'}</div>
                  <div className={styles.resultLabel}
                    style={{ color: r === 'pass' ? 'var(--status-ok-text)' : 'var(--status-err-text)' }}>
                    {r === 'pass' ? 'Pass' : 'Fail'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Evidence filename <span className={isOptional ? styles.optional : styles.required}>
              {keyword === 'SHALL' || keyword === 'SHALL NOT' ? '*' : '(optional)'}
            </span></label>
            <input
              className={styles.input}
              value={evidence}
              onChange={e => setEvidence(e.target.value)}
              placeholder="e.g. ble_timing_run_20260430.log"
              required={keyword === 'SHALL' || keyword === 'SHALL NOT'}
            />
            {(keyword === 'SHALL' || keyword === 'SHALL NOT') && (
              <div className={styles.hint}>Required for SHALL requirements. Attach the log, report, or screenshot filename.</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Notes <span className={styles.optional}>(optional)</span></label>
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={
                result === 'fail'
                  ? 'Describe the failure. What was measured? What was expected?'
                  : keyword === 'SHOULD' || keyword === 'SHOULD NOT'
                  ? 'Note any deviation from the recommendation and justification.'
                  : 'Test conditions, measured values, anomalies…'
              }
              rows={3}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={onCancel}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}
              disabled={isPending || !result}
              style={{ opacity: result ? 1 : 0.4 }}>
              {isPending ? 'Submitting…' : 'Submit result'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
