'use client'
// src/components/workspace/ItemDetail.tsx
// Renders the full chain: Intent → Requirement → Verification → Evidence
// Handles inline editing of requirement text.

import { useState, useTransition } from 'react'
import { editRequirement } from '@/lib/actions'
import styles from './ItemDetail.module.css'

interface Props {
  detail:       any
  onRunVerify:  () => void
  onSaved:      () => void
}

export function ItemDetail({ detail, onRunVerify, onSaved }: Props) {
  const { req, intent, verification } = detail
  const [editing, setEditing]         = useState(false)
  const [text, setText]               = useState(req.current_text)
  const [isPending, startTransition]  = useTransition()
  const [error, setError]             = useState<string | null>(null)

  async function handleSave() {
    if (text.trim() === req.current_text) { setEditing(false); return }
    setError(null)
    startTransition(async () => {
      try {
        await editRequirement({ item_id: req.id, text: text.trim() })
        setEditing(false)
        onSaved()
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  const isStale   = req.status === 'stale'
  const isMissing = req.status === 'missing'

  return (
    <div className={styles.root}>
      {/*  Header  */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.meta}>
            <span className={styles.displayId}>{req.display_id}</span>
            <span className={styles.dot}>·</span>
            <span>v{req.current_version}</span>
            <span className={styles.dot}>·</span>
            <span className={`${styles.statusPill} ${styles[`pill_${req.status}`]}`}>
              {req.status === 'verified' ? 'Verified' : req.status === 'stale' ? 'Stale' : 'Unverified'}
            </span>
          </div>

          {editing ? (
            <textarea
              className={styles.titleInput}
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
              rows={3}
            />
          ) : (
            <h1 className={styles.title}>{req.current_text}</h1>
          )}
        </div>

        <div className={styles.headerActions}>
          {editing ? (
            <>
              <button className={styles.btnGhost} onClick={() => { setEditing(false); setText(req.current_text) }}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSave} disabled={isPending}>
                {isPending ? 'Saving…' : `Save as v${req.current_version + 1}`}
              </button>
            </>
          ) : (
            <button className={styles.btnGhost} onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </div>

      {/*  Change warning  */}
      {editing && (verification || req.risk) && (
        <div className={styles.changeWarning}>
          <span className={styles.warnIcon}>⚠</span>
          <div>
            <div className={styles.warnTitle}>Saving will mark the following as stale</div>
            {verification && <div className={styles.warnItem}>○ {verification.display_id} , verification requires re-run</div>}
          </div>
        </div>
      )}

      {error && <div className={styles.errorBar}>{error}</div>}

      {/*  Chain  */}
      <div className={styles.chain}>

        {/* Intent */}
        <ChainNode label="Intent">
          {intent ? (
            <div className={styles.card}>
              <div className={styles.cardId}>{intent.display_id}</div>
              <div className={styles.cardText}>{intent.text}</div>
            </div>
          ) : (
            <div className={`${styles.card} ${styles.cardEmpty}`}>
              <span>Not linked</span>
            </div>
          )}
        </ChainNode>

        <Connector />

        {/* Requirement */}
        <ChainNode label="Requirement">
          <div className={`${styles.card} ${isStale ? styles.cardWarn : isMissing ? '' : styles.cardOk}`}>
            <div className={styles.cardText}>{req.current_text}</div>
            <div className={styles.cardMeta}>Version {req.current_version} · Last edited {formatDate(req.last_edited_at)}</div>
          </div>
        </ChainNode>

        <Connector />

        {/* Verification */}
        <ChainNode label="Verification">
          {verification ? (
            <div className={`${styles.card} ${isStale ? styles.cardWarn : styles.cardOk}`}>
              <div className={styles.cardId}>{verification.display_id}</div>
              <div className={styles.cardText}>{verification.text}</div>
              <div className={styles.verFields}>
                <div className={styles.verField}>
                  <span className={styles.verLabel}>Method</span>
                  <span>{verification.method}</span>
                </div>
                <div className={styles.verField}>
                  <span className={styles.verLabel}>Pass criteria</span>
                  <span className={styles.mono}>{verification.criteria}</span>
                </div>
              </div>
              {isStale && (
                <div className={styles.staleNote}>
                  Last run on v{verification.last_run ? '?' : ','} · Requirement is now v{req.current_version}
                </div>
              )}
              <div className={styles.cardAction}>
                <button className={styles.btnPrimary} onClick={onRunVerify}>
                  {isStale ? 'Re-run verification' : 'Run again'}
                </button>
              </div>
            </div>
          ) : (
            <div className={`${styles.card} ${styles.cardErr}`}>
              <div className={styles.cardText}>No verification</div>
              <div className={styles.cardAction}>
                <button className={styles.btnPrimary} onClick={onRunVerify}>Add verification</button>
              </div>
            </div>
          )}
        </ChainNode>

        <Connector />

        {/* Evidence */}
        <ChainNode label="Evidence">
          {verification?.last_run ? (
            <div className={`${styles.card} ${verification.last_run.result === 'pass' ? styles.cardOk : styles.cardErr}`}>
              <div className={styles.evidenceRow}>
                <span className={styles.evidenceFile}>
                  {verification.last_run.evidence_filename ?? 'No file attached'}
                </span>
                <span className={`${styles.resultPill} ${verification.last_run.result === 'pass' ? styles.resultPass : styles.resultFail}`}>
                  {verification.last_run.result === 'pass' ? 'Pass' : 'Fail'}
                </span>
              </div>
              {verification.last_run.notes && (
                <div className={styles.cardMeta}>{verification.last_run.notes}</div>
              )}
              <div className={styles.cardMeta}>Run {formatDate(verification.last_run.run_at)}</div>
            </div>
          ) : (
            <div className={`${styles.card} ${styles.cardEmpty}`}>
              <span>No runs yet</span>
            </div>
          )}
        </ChainNode>

      </div>
    </div>
  )
}

function ChainNode({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={styles.nodeLabel}>{label}</div>
      {children}
    </div>
  )
}

function Connector() {
  return <div className={styles.connector} />
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
