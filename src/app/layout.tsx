import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tracer',
  description: 'Requirements traceability for embedded engineers.',
}

// Inline script runs before paint to apply stored theme and prevent flash
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme')||'system';document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <ThemeSwitcher />
        </ThemeProvider>
      </body>
    </html>
  )
}
