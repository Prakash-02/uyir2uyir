import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../api/client'
import type { AppConfig } from '../api/types'
import { useT } from '../i18n/useT'
import { Play, RotateCcw } from 'lucide-react'
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
  const [isResetting, setIsResetting] = useState(false)
  const [stepProgress, setStepProgress] = useState<string | null>(null)

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
    setStepProgress('Starting demo story…')
    // Step 4: Run the story navigates to /centre immediately so staff triage is visible live
    navigate('/centre')
    try {
      const api = getApi()
      await api.runScenario('story', (_stepNum, label) => {
        setStepProgress(label)
      })
      setStepProgress('Completed: Request fulfilled!')
      setTimeout(() => {
        setStepProgress(null)
        setIsRunning(false)
      }, 3000)
    } catch (err) {
      console.error('Failed to run scenario story:', err)
      setStepProgress(null)
      setIsRunning(false)
    }
  }

  const handleReset = async () => {
    if (isRunning || isResetting) return
    setIsResetting(true)
    try {
      const api = getApi()
      await api.reset()
      setStepProgress('Demo reset to initial state')
      setTimeout(() => {
        setStepProgress(null)
        setIsResetting(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to reset demo:', err)
      setIsResetting(false)
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
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
          <span className="bg-[#1C1917] text-white px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider uppercase shrink-0">
            {t.demoBanner.badge}
          </span>
          <span className="shrink-0">{displayText}</span>

          {/* Realtime onStep indicator during story execution */}
          {stepProgress && (
            <span
              role="status"
              aria-live="assertive"
              className="bg-[#1C1917] text-[#F59E0B] px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1.5 animate-pulse shrink-0 max-w-full truncate"
              title={stepProgress}
            >
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" aria-hidden="true" />
              <span className="truncate">{stepProgress}</span>
            </span>
          )}
        </div>

        {showRunButton && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-center">
            {/* Run the story button */}
            <button
              type="button"
              onClick={handleRunStory}
              disabled={isRunning || isResetting}
              aria-label="Run the 5-step emergency blood dispatch demo story and open blood centre"
              className="min-h-[36px] px-3.5 py-1.5 bg-[#1C1917] text-white hover:bg-[#3A332F] rounded text-xs font-bold tracking-wide uppercase transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-white"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>{isRunning ? t.demoBanner.running : t.demoBanner.runStory}</span>
            </button>

            {/* Step 4: Reset demo button */}
            <button
              type="button"
              onClick={handleReset}
              disabled={isRunning || isResetting}
              aria-label="Reset demo data to initial fixtures"
              className="min-h-[36px] px-3 py-1.5 bg-black/15 hover:bg-black/25 text-[#1C1917] border border-[#1C1917]/20 rounded text-xs font-bold tracking-wide uppercase transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-[#1C1917]"
            >
              <RotateCcw className={clsx('w-3.5 h-3.5', isResetting && 'animate-spin')} aria-hidden="true" />
              <span>{isResetting ? 'Resetting…' : t.demoBanner.resetDemo}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default DemoBanner
