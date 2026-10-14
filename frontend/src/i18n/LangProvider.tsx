import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { en, type TranslationKeys } from './en'
import { ta } from './ta'
import type { Lang } from '../api/types'
import { LangContext } from './LangContext'

const STORAGE_KEY = 'u2u_lang'

function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ta') {
      return saved
    }
    if (
      typeof navigator !== 'undefined' &&
      navigator.language?.toLowerCase().startsWith('ta')
    ) {
      return 'ta'
    }
  } catch {
    // localStorage may throw in restricted sandboxes
  }
  return 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang)

  const setLang = useCallback((nextLang: Lang) => {
    setLangState(nextLang)
    try {
      localStorage.setItem(STORAGE_KEY, nextLang)
    } catch {
      // localStorage may fail silently
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLang
    }
  }, [])

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'ta' : 'en')
  }, [lang, setLang])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  const t: TranslationKeys = lang === 'ta' ? ta : en

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  )
}
