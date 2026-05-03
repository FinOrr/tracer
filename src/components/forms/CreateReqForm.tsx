'use client'
// src/components/forms/CreateReqForm.tsx
// Requirement authoring with:
//   - RFC 2119 keyword picker (SHALL / SHOULD / MAY) with inline guidance
//   - EARS-assisted text builder (subject + keyword + predicate)
//   - Intent linking

import { useState, useTransition } from 'react'
import { createRequirement } from '@/lib/actions'
import { KEYWORD_META, type RequirementKeyword } from '@/types'
import styles from './Form.module.css'

const KEYWORDS: RequirementKeyword[] = ['SHALL', 'SHALL NOT', 'SHOULD', 'SHOULD NOT', 'MAY']

// Verification method guidance per keyword , surfaced in the form
const VERIFICATION_HINT: Record<RequirementKeyword, string> = {
  'SHALL':     'Must be formally verified. A test, measurement, or analysis with a documented pass/fail result is required.',
  'SHALL NOT': 'Must be formally verified. Demonstrate the prohibited behaviour cannot occur.',
  'SHOULD':    'Should be verified. If not tested, document the justification for waiving.',
  'SHOULD NOT':'Should be verified. If not tested, document the justification for waiving.',
  'MAY':       'Verification is optional. Record it if implemented, but no test is required.',
}

interface Props {
  projectId: string
  intents:   any[]
  onCancel:  () => void
  onSaved:   (newId: string) => void
  onNewIntent: () => void
}

export function CreateReqForm({ projectId, intents, onCancel, onSaved, onNewIntent }: Props) {
  const [subject, setSubject]     = useState('The system')
  const [keyword, setKeyword]     = useState<RequirementKeyword>('SHALL')
  const [predicate, setPredicate] = useState('')
  const [intentId, setIntentId]   = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [isPending, start]        = useTransition()

  // Compose EARS text: "[Subject] [KEYWORD] [predicate]."
  const composed = subject.trim() && predicate.trim()
    ? `${subject.trim()} ${keyword} ${predicate.trim().replace(/\.$/, '')}.`
    : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!composed) return
    setError(null)
    start(async () => {
      try {
        const item = await createRequirement({
          project_id:     projectId,
          text:           composed,
          intent_item_id: intentId || undefined,
        })
        onSaved(item.id)
      } catch (e: any) { setError(e.message) }
    })
  }

  const kwMeta = KEYWORD_META[keyword]

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.heading}>New requirement</div>
        <div className={styles.sub}>EARS format , Subject · Keyword · Predicate</div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>

        {/*  Keyword picker  */}
        <div className={styles.field}>
          <label className={styles.label}>
            Obligation keyword <span className={styles.required}>*</span>
          </label>
          <div className={styles.keywordRow}>
            {KEYWORDS.map(kw => (
              <button
                key={kw}
                type="button"
                className={`${styles.kwBtn} ${keyword === kw ? styles.kwActive : ''}`}
                style={keyword === kw ? { borderColor: KEYWORD_META[kw].color, color: KEYWORD_META[kw].color } : {}}
                onClick={() => setKeyword(kw)}
              >
                {kw}
              </button>
            ))}
          </div>

          {/* Inline keyword guidance */}
          <div className={styles.kwGuidance} style={{ borderLeftColor: kwMeta.color }}>
            <div className={styles.kwGuidanceTitle} style={{ color: kwMeta.color }}>{kwMeta.label}</div>
            <div className={styles.kwGuidanceText}>{kwMeta.meaning}</div>
            <div className={styles.kwGuidanceVerify}>
              <span className={styles.kwGuidanceVerifyIcon}>⊙</span>
              {VERIFICATION_HINT[keyword]}
            </div>
          </div>
        </div>

        {/*  EARS builder  */}
        <div className={styles.field}>
          <label className={styles.label}>Subject <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. The device, The system, The firmware"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Predicate <span className={styles.required}>*</span></label>
          <textarea
            className={styles.textarea}
            value={predicate}
            onChange={e => setPredicate(e.target.value)}
            placeholder="e.g. establish a BLE connection within 5 seconds of power-on"
            rows={3}
            autoFocus
            required
          />
          <div className={styles.hint}>
            Include measurable values , not "fast", but "within 5 s".
          </div>
        </div>

        {/*  Live preview  */}
        {composed && (
          <div className={styles.preview}>
            <div className={styles.previewLabel}>Composed requirement</div>
            <div className={styles.previewText}>
              {subject.trim()}{' '}
              <span style={{ fontWeight: 700, color: kwMeta.color }}>{keyword}</span>{' '}
              {predicate.trim().replace(/\.$/, '')}.
            </div>
          </div>
        )}

        {/*  Intent link  */}
        <div className={styles.field}>
          <label className={styles.label}>
            Linked intent <span className={styles.optional}>(recommended)</span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              className={styles.select}
              style={{ flex: 1 }}
              value={intentId}
              onChange={e => setIntentId(e.target.value)}
            >
              <option value="">None</option>
              {intents.map((i: any) => {
                const t = i.item_versions?.[0]?.text ?? i.display_id
                return (
                  <option key={i.id} value={i.id}>
                    {i.display_id} · {t.slice(0, 55)}{t.length > 55 ? '…' : ''}
                  </option>
                )
              })}
            </select>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={onNewIntent}
              title="Create a new intent"
            >
              New intent
            </button>
          </div>
          <div className={styles.hint}>
            Link an intent to keep requirements traceable to their source.
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>Cancel</button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={isPending || !composed}
          >
            {isPending ? 'Creating…' : 'Create requirement'}
          </button>
        </div>

      </form>
    </div>
  )
}
