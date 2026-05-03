'use client'
// src/components/workspace/TraceTable.tsx
// The full traceability matrix.
// Requirement → Verification → Evidence. Every row. No hiding.
// Engineers will screenshot or export this. Make it trustworthy.

import { useTransition } from 'react'
import type { TraceRow } from '@/types'
import styles from './TraceTable.module.css'

interface Props {
  rows:      TraceRow[]
  projectName: string
  onSelectReq: (id: string) => void
}

export function TraceTable({ rows, projectName, onSelectReq }: Props) {
  const [, start] = useTransition()

  const verified = rows.filter(r => r.req.status === 'verified').length
  const total    = rows.length
  const pct      = total ? Math.round((verified / total) * 100) : 0

  function exportCSV() {
    const header = ['ID', 'Version', 'Requirement', 'Status', 'Verification ID', 'Method', 'Criteria', 'Last Result', 'Evidence', 'Run At']
    const rowData = rows.map(({ req, verification, run }) => [
      req.display_id,
      `v${req.current_version}`,
      `"${req.current_text.replace(/"/g, '""')}"`,
      req.status,
      verification?.display_id ?? '',
      verification?.method     ?? '',
      `"${(verification?.criteria ?? '').replace(/"/g, '""')}"`,
      run?.result              ?? '',
      run?.evidence_filename   ?? '',
      run ? new Date(run.run_at).toISOString() : '',
    ])
    const csv = [header, ...rowData].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${projectName.replace(/\s+/g, '_')}_trace_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.root}>
      {/*  Header  */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Trace matrix</h2>
          <div className={styles.sub}>
            Intent → Requirement → Verification → Evidence
          </div>
        </div>
        <button className={styles.exportBtn} onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      {/*  Coverage bar  */}
      <div className={styles.coverage}>
        <div className={styles.coverageBar}>
          <div
            className={styles.coverageFill}
            style={{
              width: `${pct}%`,
              background: pct >= 80 ? 'var(--status-ok)' : pct >= 50 ? 'var(--status-warn)' : 'var(--status-err)',
            }}
          />
        </div>
        <span className={styles.coveragePct}
          style={{ color: pct >= 80 ? 'var(--status-ok-text)' : pct >= 50 ? 'var(--status-warn-text)' : 'var(--status-err-text)' }}>
          {pct}% verified
        </span>
        <span className={styles.coverageTotal}>{verified} of {total} requirements</span>
      </div>

      {/*  Table  */}
      {!rows.length ? (
        <div className={styles.empty}>No requirements.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Requirement</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Verification</th>
                <th className={styles.th}>Criteria</th>
                <th className={styles.th}>Result</th>
                <th className={styles.th}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ req, verification, run }) => (
                <tr
                  key={req.id}
                  className={`${styles.tr} ${req.status === 'stale' ? styles.trWarn : req.status === 'missing' ? styles.trErr : ''}`}
                  onClick={() => onSelectReq(req.id)}
                >
                  {/* Requirement */}
                  <td className={styles.td}>
                    <div className={styles.reqId}>{req.display_id} <span className={styles.ver}>v{req.current_version}</span></div>
                    <div className={styles.reqText}>{req.current_text}</div>
                  </td>

                  {/* Status */}
                  <td className={styles.td}>
                    <span className={`${styles.statusPill} ${styles[`pill_${req.status}`]}`}>
                      {req.status === 'verified' ? 'Verified' : req.status === 'stale' ? 'Stale' : 'Missing'}
                    </span>
                  </td>

                  {/* Verification */}
                  <td className={styles.td}>
                    {verification ? (
                      <>
                        <div className={styles.verId}>{verification.display_id}</div>
                        <div className={styles.verMethod}>{verification.method}</div>
                      </>
                    ) : (
                      <span className={styles.none}>,</span>
                    )}
                  </td>

                  {/* Criteria */}
                  <td className={styles.td}>
                    {verification?.criteria
                      ? <span className={styles.criteria}>{verification.criteria}</span>
                      : <span className={styles.none}>,</span>}
                  </td>

                  {/* Result */}
                  <td className={styles.td}>
                    {run ? (
                      <span className={`${styles.resultPill} ${run.result === 'pass' ? styles.resultPass : styles.resultFail}`}>
                        {run.result === 'pass' ? 'Pass' : 'Fail'}
                      </span>
                    ) : (
                      <span className={styles.none}>,</span>
                    )}
                  </td>

                  {/* Evidence */}
                  <td className={styles.td}>
                    {run?.evidence_filename
                      ? <span className={styles.evidence}>{run.evidence_filename}</span>
                      : <span className={styles.none}>,</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
