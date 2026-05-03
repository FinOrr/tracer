'use client'
// src/components/ThemeSwitcher.tsx

import { useState, useRef, useEffect } from 'react'
import { useTheme, type Theme } from './ThemeProvider'
import styles from './ThemeSwitcher.module.css'

const THEMES: { id: Theme; label: string; bg: string; surface: string; accent: string }[] = [
  { id: 'system',    label: 'System',    bg: '#d0d8e4', surface: '#f0ece5', accent: '#888' },
  { id: 'nord',      label: 'Nord',      bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0' },
  { id: 'monokai',   label: 'Monokai',   bg: '#272822', surface: '#2c2d26', accent: '#66d9e8' },
  { id: 'oxford',    label: 'Oxford',    bg: '#f8f5ef', surface: '#fffef9', accent: '#002147' },
  { id: 'turtle',    label: 'Turtle',    bg: '#eef3f8', surface: '#ffffff', accent: '#2563eb' },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const active = THEMES.find(t => t.id === theme) ?? THEMES[0]

  return (
    <div className={styles.root} ref={ref}>
      {open && (
        <div className={styles.panel}>
          <div className={styles.panelLabel}>Theme</div>
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`${styles.option} ${theme === t.id ? styles.optionActive : ''}`}
              onClick={() => { setTheme(t.id); setOpen(false) }}
            >
              <span className={styles.swatch}>
                <span className={styles.swatchBg} style={{ background: t.bg }} />
                <span className={styles.swatchSurface} style={{ background: t.surface }} />
                <span className={styles.swatchAccent} style={{ background: t.accent }} />
              </span>
              <span className={styles.optionLabel}>{t.label}</span>
              {theme === t.id && <span className={styles.check}>✓</span>}
            </button>
          ))}
        </div>
      )}
      <button
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-label="Change theme"
        title="Change theme"
      >
        <span className={styles.triggerSwatch}>
          <span style={{ background: active.bg, flex: 1, borderRadius: '3px 0 0 3px' }} />
          <span style={{ background: active.accent, width: 6, borderRadius: '0 3px 3px 0' }} />
        </span>
      </button>
    </div>
  )
}
