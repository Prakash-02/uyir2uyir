import { useState, useCallback } from 'react'
import { en } from './en'
import { ta } from './ta'
import type { Lang } from '../api/types'

export function useT() {
  const [lang, setLang] = useState<Lang>('en')

  const t = lang === 'ta' ? ta : en

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'en' ? 'ta' : 'en'))
  }, [])

  return { lang, setLang, toggleLang, t }
}
