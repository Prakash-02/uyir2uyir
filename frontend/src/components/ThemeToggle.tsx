import { useState, useCallback } from 'react'
import { Sun, Moon } from 'lucide-react'
import clsx from 'clsx'

export type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme')
    if (attr === 'dark' || attr === 'light') return attr
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

export interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      className={clsx(
        'min-h-[48px] min-w-[48px] p-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]/20 transition-colors inline-flex items-center justify-center cursor-pointer select-none focus-visible:outline-3 focus-visible:outline-[var(--info)] focus-visible:outline-offset-2',
        className,
      )}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-[var(--muted)]" aria-hidden="true" />
      ) : (
        <Sun className="w-5 h-5 text-[var(--warning)]" aria-hidden="true" />
      )}
    </button>
  )
}
