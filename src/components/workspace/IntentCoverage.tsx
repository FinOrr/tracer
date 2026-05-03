'use client'
// src/components/workspace/IntentCoverage.tsx
// Stories view — shows each intent and the requirements that serve it,
// with aggregate coverage so you can see at a glance whether a user story
// is fully verified, partially covered, or not covered at all.

import type { RequirementRow } from '@/types'
import styles from './IntentCoverage.module.css'

interface IntentItem {
  id:         string
  display_id: string
  text:       string
}

interface ReqLink {
  from_item_id: string  // requirement id
  to_item_id:   string  // intent id
}

interface Props {
  intents:      IntentItem[]
  requirements: RequirementRow[]
  reqLinks:     ReqLink[]
  onSelectReq:  (id: string) => void
}

export function IntentCoverage({ intents, requirements, reqLinks, onSelectReq }: Props) {
  // Build lookup: intentId → requirement ids
  const intentToReqs = new Map<string, string[]>()
  for (const link of reqLinks) {
    const list = intentToReqs.get(link.to_item_id) ?? []
    list.push(link.from_item_id)
    intentToReqs.set(link.to_item_id, list)
  }

  // Requirements not linked to any intent
  const linkedReqIds = new Set(reqLinks.map(l => l.from_item_id))
  const orphans      = requirements.filter(r => !linkedReqIds.has(r.id))

  const reqById = new Map(requirements.map(r => [r.id, r]))

  if (!intents.length && !orphans.length) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <h2 className={styles.heading}>Stories</h2>
          <div className={styles.sub}>Intent → Requirements → Verification</div>
        </div>
        <div className={styles.empty}>No intents yet.</div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Stories</h2>
          <div className={styles.sub}>Intent → Requirements → Verification</div>
        </div>
      </div>

      <div className={styles.list}>
        {intents.map(intent => {
          const linkedIds = intentToReqs.get(intent.id) ?? []
          const reqs      = linkedIds.map(id => reqById.get(id)).filter(Boolean) as RequirementRow[]
          const verified  = reqs.filter(r => r.status === 'verified').length
          const total     = reqs.length
          const pct       = total ? Math.round((verified / total) * 100) : 0
          const coverageStatus: 'ok' | 'warn' | 'err' | 'none' =
            total === 0 ? 'none' :
            pct === 100 ? 'ok' :
            pct > 0     ? 'warn' : 'err'

          return (
            <div key={intent.id} className={styles.intentBlock}>
              <div className={styles.intentHeader}>
                <div className={styles.intentMeta}>
                  <span className={styles.intentId}>{intent.display_id}</span>
                  <span className={`${styles.coveragePill} ${styles[`pill_${coverageStatus}`]}`}>
                    {total === 0 ? 'No requirements' : `${verified}/${total} verified`}
                  </span>
                </div>
                <div className={styles.intentText}>{intent.text}</div>
                {total > 0 && (
                  <div className={styles.bar}>
                    <div
                      className={`${styles.barFill} ${styles[`fill_${coverageStatus}`]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>

              {total === 0 ? (
                <div className={styles.noReqs}>No requirements linked to this story</div>
              ) : (
                <div className={styles.reqList}>
                  {reqs.map(req => (
                    <button
                      key={req.id}
                      className={styles.reqRow}
                      onClick={() => onSelectReq(req.id)}
                    >
                      <span className={`${styles.statusDot} ${styles[`dot_${req.status}`]}`} />
                      <span className={styles.reqId}>{req.display_id}</span>
                      <span className={styles.reqText}>{req.current_text}</span>
                      <span className={`${styles.statusLabel} ${styles[`label_${req.status}`]}`}>
                        {req.status === 'verified' ? 'Verified' : req.status === 'stale' ? 'Stale' : 'No verification'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {orphans.length > 0 && (
          <div className={styles.intentBlock}>
            <div className={styles.intentHeader}>
              <div className={styles.intentMeta}>
                <span className={styles.intentId}>Unlinked</span>
                <span className={`${styles.coveragePill} ${styles.pill_none}`}>
                  {orphans.length} requirement{orphans.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className={styles.intentText}>Requirements not linked to any story</div>
            </div>
            <div className={styles.reqList}>
              {orphans.map(req => (
                <button
                  key={req.id}
                  className={styles.reqRow}
                  onClick={() => onSelectReq(req.id)}
                >
                  <span className={`${styles.statusDot} ${styles[`dot_${req.status}`]}`} />
                  <span className={styles.reqId}>{req.display_id}</span>
                  <span className={styles.reqText}>{req.current_text}</span>
                  <span className={`${styles.statusLabel} ${styles[`label_${req.status}`]}`}>
                    {req.status === 'verified' ? 'Verified' : req.status === 'stale' ? 'Stale' : 'No verification'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
