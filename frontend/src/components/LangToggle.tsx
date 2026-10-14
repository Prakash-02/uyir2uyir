import { useCallback } from 'react'
import type { Lang } from '../api/types'
import { useT } from '../i18n/useT'
import clsx from 'clsx'

export interface LangToggleProps {
  currentLang?: Lang
  onLangChange?: (lang: Lang) => void
  className?: string
}

export function LangToggle({ currentLang, onLangChange, className }: LangToggleProps) {
  const context = useT()
  const activeLang = currentLang ?? context.lang

  const toggle = useCallback(() => {
    const nextLang: Lang = activeLang === 'en' ? 'ta' : 'en'
    if (onLangChange) {
      onLangChange(nextLang)
    } else {
      context.setLang(nextLang)
    }
  }, [activeLang, onLangChange, context])

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        activeLang === 'en'
          ? context.t.controls.langToggle
          : 'Switch language to English'
      }
      className={clsx(
        'min-h-[48px] px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--border)]/20 transition-colors cursor-pointer select-none focus-visible:outline-3 focus-visible:outline-[var(--info)] focus-visible:outline-offset-2',
        className,
      )}
    >
      <span
        className={
          activeLang === 'en'
            ? 'text-[var(--primary)] font-bold'
            : 'text-[var(--muted)]'
        }
      >
        EN
      </span>
      <span className="text-[var(--muted)]">/</span>
      <span
        lang="ta"
        className={
          activeLang === 'ta'
            ? 'text-[var(--primary)] font-bold'
            : 'text-[var(--muted)]'
        }
      >
        த
      </span>
    </button>
  )
}
