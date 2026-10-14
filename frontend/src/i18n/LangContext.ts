import { createContext, useContext } from 'react'
import { en, type TranslationKeys } from './en'
import type { Lang } from '../api/types'

export interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
  t: TranslationKeys
}

export const LangContext = createContext<LangContextValue | null>(null)

export function useT(): LangContextValue {
  const context = useContext(LangContext)
  if (!context) {
    return {
      lang: 'en',
      setLang: () => {},
      toggleLang: () => {},
      t: en,
    }
  }
  return context
}
