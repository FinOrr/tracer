'use client'
// src/components/ThemeProvider.tsx

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'system' | 'nord' | 'monokai' | 'oxford' | 'turtle'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'system', setTheme: () => {} })

export function useTheme() { return useContext(ThemeContext) }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    const initial = stored ?? 'system'
    setThemeState(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
