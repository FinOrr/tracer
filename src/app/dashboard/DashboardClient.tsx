'use client'
// src/app/dashboard/DashboardClient.tsx

import { useState, useTransition } from 'react'
import { createProject, signOut }  from '@/lib/actions'
import type { Project }            from '@/types'
import styles from './dashboard.module.css'

interface Props { projects: Project[] }

export function DashboardClient({ projects }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    start(async () => {
      try {
        const p = await createProject({ name, description: desc })
        window.location.href = `/project/${p.id}`
      } catch (err: any) { setError(err.message) }
    })
  }

  async function handleSignOut() {
    await signOut()
    window.location.href = '/auth/signin'
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>TRACER</div>
          <h1 className={styles.heading}>Projects</h1>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>+ New project</button>
          <button className={styles.btnGhost}   onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      {showForm && (
        <div className={styles.formCard}>
          <div className={styles.formHeading}>New project</div>
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Name <span className={styles.required}>*</span></label>
              <input className={styles.input} value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. BLE Sensor Module v2" autoFocus required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Description <span className={styles.optional}>(optional)</span></label>
              <input className={styles.input} value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Brief description of the system or product" />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.formActions}>
              <button type="button" className={styles.btnGhost}
                onClick={() => { setShowForm(false); setName(''); setDesc(''); setError(null) }}>
                Cancel
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={isPending || !name.trim()}>
                {isPending ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!projects.length && !showForm ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No projects yet</div>
          <div className={styles.emptySub}>Create a project to start tracing.</div>
          <button className={styles.btnPrimary} style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
            + New project
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map(p => (
            <a key={p.id} href={`/project/${p.id}`} className={styles.card}>
              <div className={styles.cardName}>{p.name}</div>
              {p.description && <div className={styles.cardDesc}>{p.description}</div>}
              <div className={styles.cardMeta}>
                {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
