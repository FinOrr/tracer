'use client'
// src/components/forms/CreateIntentForm.tsx
// Intents are the "why" , user stories or stakeholder goals.
// Format: As a [role], I need [capability], so that [outcome].

import { useState, useTransition } from 'react'
import { createIntent } from '@/lib/actions'
import styles from './Form.module.css'

interface Props {
  projectId: string
  onCancel:  () => void
  onSaved:   (id: string) => void
}

export function CreateIntentForm({ projectId, onCancel, onSaved }: Props) {
  const [role, setRole]           = useState('')
  const [capability, setCap]      = useState('')
  const [outcome, setOutcome]     = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [isPending, start]        = useTransition()

  // Compose the intent text from the three fields
  const composed = role && capability
    ? `As a ${role}, I need ${capability}${outcome ? `, so that ${outcome}` : ''}.`
    : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!composed) return
    setError(null)
    start(async () => {
      try {
        const item = await createIntent({ project_id: projectId, text: composed })
        onSaved(item.id)
      } catch (e: any) { setError(e.message) }
    })
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.heading}>New intent</div>
        <div className={styles.sub}>
          Capture a stakeholder need that requirements can trace back to.
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>

        <div className={styles.field}>
          <label className={styles.label}>Role <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder="e.g. field technician, safety system, firmware engineer"
            autoFocus
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Capability needed <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            value={capability}
            onChange={e => setCap(e.target.value)}
            placeholder="e.g. fast BLE connection on power-on"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Outcome <span className={styles.optional}>(recommended)</span></label>
          <input
            className={styles.input}
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder="e.g. site visits are shorter and device is ready immediately"
          />
        </div>

        {/* Live preview */}
        {composed && (
          <div className={styles.preview}>
            <div className={styles.previewLabel}>Preview</div>
            <div className={styles.previewText}>{composed}</div>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>Cancel</button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={isPending || !composed}
          >
            {isPending ? 'Creating…' : 'Create intent'}
          </button>
        </div>
      </form>
    </div>
  )
}
