import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../api/client'
import type { AppConfig } from '../api/types'
import { useT } from '../i18n/useT'
import { Play } from 'lucide-react'
import clsx from 'clsx'

export interface DemoBannerProps {
  text?: string
  className?: string
  showRunButton?: boolean
}

export function DemoBanner({
  text,
  className,
  showRunButton = true,
}: DemoBannerProps) {
  const { t } = useT()
  const navigate = useNavigate()
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    let mounted = true
    const api = getApi()
    api.getConfig()
      .then((cfg) => {
        if (mounted) setConfig(cfg)
      })
      .catch((err) => {
        console.warn('Failed to load AppConfig in DemoBanner:', err)
      })
    return () => {
      mounted = false
    }
  }, [])

  // In demo mode or if explicit text is provided, display the banner
  const isDemo = config ? config.dataMode === 'demo' : true
  if (!isDemo && !text) {
    return null
  }

  const displayText =
    text ?? config?.bannerText ?? t.demoBanner.text

  const handleRunStory = async () => {
    if (isRunning) return
    setIsRunning(true)
    try {
      const api = getApi()
      await api.runScenario('story')
      navigate('/centre')
    } catch (err) {
      console.error('Failed to run scenario story:', err)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'sticky top-0 z-50 w-full bg-[var(--demo)] text-[#1C1917] px-4 py-2 text-xs sm:text-sm font-bold tracking-wide uppercase shadow-xs select-none transition-colors',
        className,
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="bg-[#1C1917] text-white px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider uppercase">
            {t.demoBanner.badge}
          </span>
          <span>{displayText}</span>
        </div>

        {showRunButton && (
          <button
            type="button"
            onClick={handleRunStory}
            disabled={isRunning}
            aria-label="Run the 5-step emergency blood dispatch demo story and open blood centre"
            className="min-h-[36px] px-3.5 py-1.5 bg-[#1C1917] text-white hover:bg-[#3A332F] rounded text-xs font-bold tracking-wide uppercase transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-white"
          >
            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>{isRunning ? t.demoBanner.running : t.demoBanner.runStory}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default DemoBanner
