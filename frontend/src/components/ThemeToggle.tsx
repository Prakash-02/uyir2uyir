import { useTheme, type ThemeChoice } from '../lib/theme'
import { Sun, Moon, Laptop } from 'lucide-react'
import clsx from 'clsx'

export interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, cycleTheme } = useTheme()

  const labels: Record<ThemeChoice, string> = {
    light: 'Light theme (click for dark)',
    dark: 'Dark theme (click for system)',
    system: 'System theme (click for light)',
  }

  const renderIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-5 h-5 text-[var(--warning)]" aria-hidden="true" />
      case 'dark':
        return <Moon className="w-5 h-5 text-[var(--info)]" aria-hidden="true" />
      case 'system':
      default:
        return <Laptop className="w-5 h-5 text-[var(--muted)]" aria-hidden="true" />
    }
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={labels[theme]}
      title={labels[theme]}
      className={clsx(
        'min-h-[48px] min-w-[48px] px-2.5 py-2 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]/20 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer select-none focus-visible:outline-3 focus-visible:outline-[var(--info)] focus-visible:outline-offset-2',
        className,
      )}
    >
      {renderIcon()}
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] hidden sm:inline">
        {theme === 'system' ? 'Auto' : theme}
      </span>
    </button>
  )
}

export default ThemeToggle
