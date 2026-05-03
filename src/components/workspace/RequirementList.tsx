'use client'
// src/components/workspace/RequirementList.tsx

import type { RequirementRow } from '@/types'
import styles from './RequirementList.module.css'

const STATUS_META: Record<string, string> = {
  verified: 'Verified',
  stale:    'Stale',
  missing:  'No verification',
}

interface Props {
  items:      RequirementRow[]
  selectedId: string | null
  onSelect:   (id: string) => void
}

export function RequirementList({ items, selectedId, onSelect }: Props) {
  if (!items.length) {
    return (
      <div className={styles.empty}>
        No requirements yet.
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {items.map(item => (
        <button
          key={item.id}
          className={`${styles.item} ${selectedId === item.id ? styles.selected : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <div className={`${styles.dot} ${styles[`dot_${item.status}`]}`} />
          <div className={styles.body}>
            <div className={styles.id}>{item.display_id}</div>
            <div className={styles.text}>{item.current_text}</div>
            <div className={styles.meta}>{STATUS_META[item.status]}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
