'use client'
// src/components/workspace/Workspace.tsx

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter }               from 'next/navigation'
import type { RequirementRow, TraceRow } from '@/types'
import { RequirementList }   from './RequirementList'
import { ItemDetail }        from './ItemDetail'
import { TraceTable }        from './TraceTable'
import { IntentCoverage }    from './IntentCoverage'
import { VerifyRunForm }     from '../forms/VerifyRunForm'
import { CreateReqForm }     from '../forms/CreateReqForm'
import { CreateIntentForm }  from '../forms/CreateIntentForm'
import styles      from './Workspace.module.css'
import toastStyles from './Toast.module.css'

type Screen   = 'detail' | 'create-req' | 'create-intent' | 'verify'
type MainView = 'chain' | 'trace' | 'stories'

interface Props {
  project:           { id: string; name: string }
  requirements:      RequirementRow[]
  traceRows:         TraceRow[]
  intents:           any[]
  reqLinks:          { from_item_id: string; to_item_id: string }[]
  initialDetail:     any | null
  initialSelectedId: string | null
}

export function Workspace({
  project, requirements, traceRows, intents, reqLinks, initialDetail, initialSelectedId
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId)
  const [detail, setDetail]         = useState<any | null>(initialDetail)
  const [screen, setScreen]         = useState<Screen>('detail')
  const [mainView, setMainView]     = useState<MainView>('chain')
  const [filter, setFilter]         = useState<'all' | 'issues'>('all')
  const [pendingIntentReturn, setPendingIntentReturn] = useState(false)
  const [toast, setToast]           = useState<{ msg: string; type: 'pass' | 'fail' } | null>(null)
  const toastTimer                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [leftWidth, setLeftWidth]   = useState(272)
  const isDragging  = useRef(false)
  const dragStart   = useRef({ x: 0, width: 0 })

  function onResizeStart(e: React.MouseEvent) {
    if (e.button !== 0) return
    isDragging.current = true
    dragStart.current  = { x: e.clientX, width: leftWidth }
    e.preventDefault()
  }

  function showToast(msg: string, type: 'pass' | 'fail') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // Sync server-rendered detail/selection back into state after navigation
  useEffect(() => { setDetail(initialDetail) },     [initialDetail])
  useEffect(() => { setSelectedId(initialSelectedId) }, [initialSelectedId])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return
      const max     = window.innerWidth * 0.5
      const raw     = dragStart.current.width + (e.clientX - dragStart.current.x)
      const clamped = Math.max(0, Math.min(max, raw))
      setLeftWidth(clamped < 80 ? 0 : clamped)
    }
    function onUp() { isDragging.current = false }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  function selectItem(id: string) {
    setSelectedId(id)
    setScreen('detail')
    setMainView('chain')
    startTransition(() => {
      router.push(`/project/${project.id}?item=${id}`, { scroll: false })
    })
  }

  function handleNewIntent() {
    setPendingIntentReturn(true)
    setScreen('create-intent')
  }

  function handleIntentSaved() {
    router.refresh()
    setPendingIntentReturn(false)
    setScreen('create-req')
  }

  const filtered   = filter === 'all' ? requirements : requirements.filter(r => r.status !== 'verified')
  const issueCount = requirements.filter(r => r.status !== 'verified').length

  return (
    <div className={styles.root}>
      {/*  Left panel  */}
      <aside className={styles.left} style={{ width: leftWidth }}>
        <div className={styles.leftHeader}>
          <a href="/dashboard" className={styles.backLink}>← Projects</a>
          <div className={styles.projectName}>{project.name}</div>
        </div>

        {/* View toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${mainView === 'chain' ? styles.viewBtnActive : ''}`}
            onClick={() => { setMainView('chain'); setScreen('detail') }}
          >Chain</button>
          <button
            className={`${styles.viewBtn} ${mainView === 'trace' ? styles.viewBtnActive : ''}`}
            onClick={() => setMainView('trace')}
          >Trace</button>
          <button
            className={`${styles.viewBtn} ${mainView === 'stories' ? styles.viewBtnActive : ''}`}
            onClick={() => setMainView('stories')}
          >Stories</button>
        </div>

        <div className={styles.filters}>
          <button className={`${styles.filter} ${filter === 'all' ? styles.filterActive : ''}`}
            onClick={() => setFilter('all')}>All</button>
          <button className={`${styles.filter} ${filter === 'issues' ? styles.filterActive : ''}`}
            onClick={() => setFilter('issues')}>
            Issues
            {issueCount > 0 && <span className={styles.badge}>{issueCount}</span>}
          </button>
        </div>

        <RequirementList items={filtered} selectedId={selectedId} onSelect={selectItem} />

        <div className={styles.addArea}>
          <button className={styles.addBtn}          onClick={() => setScreen('create-req')}>+ New requirement</button>
          <button className={styles.addBtn}           onClick={() => { setPendingIntentReturn(false); setScreen('create-intent') }}>+ New intent</button>
        </div>
      </aside>

      {/* Resize handle */}
      <div
        className={`${styles.resizeHandle} ${leftWidth === 0 ? styles.resizeHandleCollapsed : ''}`}
        onMouseDown={onResizeStart}
        onClick={() => { if (leftWidth === 0) setLeftWidth(272) }}
        title={leftWidth === 0 ? 'Show panel' : 'Drag to resize · double-click to collapse'}
        onDoubleClick={() => setLeftWidth(w => w === 0 ? 272 : 0)}
      />

      {/*  Right panel  */}
      <main className={styles.right}>

        {/* Trace table view */}
        {mainView === 'trace' && screen === 'detail' && (
          <TraceTable
            rows={traceRows}
            projectName={project.name}
            onSelectReq={(id) => selectItem(id)}
          />
        )}

        {/* Stories view */}
        {mainView === 'stories' && screen === 'detail' && (
          <IntentCoverage
            intents={intents.map((i: any) => ({
              id:         i.id,
              display_id: i.display_id,
              text:       i.item_versions?.[0]?.text ?? i.display_id,
            }))}
            requirements={requirements}
            reqLinks={reqLinks}
            onSelectReq={(id) => { selectItem(id); setMainView('chain') }}
          />
        )}

        {/* Chain view , forms + item detail */}
        {(mainView === 'chain' || screen !== 'detail') && (
          <>
            {screen === 'create-intent' && (
              <CreateIntentForm
                projectId={project.id}
                onCancel={() => setScreen(pendingIntentReturn ? 'create-req' : 'detail')}
                onSaved={handleIntentSaved}
              />
            )}

            {screen === 'create-req' && (
              <CreateReqForm
                projectId={project.id}
                intents={intents}
                onCancel={() => setScreen('detail')}
                onSaved={(id) => selectItem(id)}
                onNewIntent={handleNewIntent}
              />
            )}

            {screen === 'verify' && detail?.req && (
              <VerifyRunForm
                projectId={project.id}
                requirement={detail.req}
                verification={detail.verification}
                onCancel={() => setScreen('detail')}
                onSaved={(run) => {
                  setDetail((prev: any) => prev?.verification
                    ? { ...prev, verification: { ...prev.verification, last_run: run } }
                    : prev)
                  setScreen('detail')
                  router.refresh()
                  showToast(
                    run.result === 'pass'
                      ? `${detail.req.display_id} verified`
                      : `${detail.req.display_id} — fail recorded`,
                    run.result
                  )
                }}
                onVerificationCreated={(ver) =>
                  setDetail((prev: any) => prev ? { ...prev, verification: ver } : prev)
                }
              />
            )}

            {screen === 'detail' && (
              detail
                ? <ItemDetail
                    detail={detail}
                    onRunVerify={() => setScreen('verify')}
                    onSaved={() => router.refresh()}
                  />
                : <div className={styles.empty}>
                    <div className={styles.emptyHint}>Select a requirement</div>
                  </div>
            )}
          </>
        )}
      </main>

      {toast && (
        <div key={toast.msg + toast.type} className={`${toastStyles.toast} ${toastStyles[`toast_${toast.type}`]}`}>
          <span className={toastStyles.icon}>{toast.type === 'pass' ? '✓' : '✕'}</span>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
