import { useMemo } from 'react'
import clsx from 'clsx'

export interface ProgressBannerProps {
  unitsNeeded: number
  accepted: number
  onTheWay: number
  label?: string
  className?: string
}

export function ProgressBanner({
  unitsNeeded,
  accepted,
  onTheWay,
  label,
  className,
}: ProgressBannerProps) {
  const covered = accepted + onTheWay
  const safeTarget = Math.max(1, unitsNeeded)
  const pct = Math.min(100, Math.max(0, Math.round((covered / safeTarget) * 100)))
  const acceptedPct = Math.min(100, Math.max(0, Math.round((accepted / safeTarget) * 100)))

  const defaultText = useMemo(() => {
    if (accepted >= safeTarget) {
      return `${accepted} of ${safeTarget} units accepted — Request Fulfilled`
    }
    if (covered > safeTarget) {
      return `${covered} donors reached target (1 spare on the way) — ${accepted} accepted, ${onTheWay} on the way`
    }
    return `${covered} of ${safeTarget} units covered — ${onTheWay} on the way, ${accepted} accepted`
  }, [accepted, covered, onTheWay, safeTarget])

  const displayText = label ?? defaultText

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-4 sm:p-5 shadow-xs select-none',
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] animate-pulse" aria-hidden="true" />
          <span className="font-heading font-bold text-base sm:text-lg text-[var(--text)]">
            {displayText}
          </span>
        </div>
        <div className="font-heading font-bold text-sm sm:text-base text-[var(--primary)] tnum self-end sm:self-auto">
          {covered} / {safeTarget} units ({pct}%)
        </div>
      </div>

      {/* Progress Track */}
      <div
        className="w-full h-3 rounded-full bg-[var(--border)]/60 overflow-hidden relative"
        role="progressbar"
        aria-valuenow={covered}
        aria-valuemin={0}
        aria-valuemax={safeTarget}
        aria-label="Blood units coverage progress"
      >
        {/* On the way portion */}
        <div
          className="h-full bg-[var(--info)] transition-all duration-300 ease-out absolute left-0 top-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
        {/* Accepted portion (solid success) */}
        <div
          className="h-full bg-[var(--success)] transition-all duration-300 ease-out absolute left-0 top-0 rounded-full"
          style={{ width: `${acceptedPct}%` }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2.5 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--success)]" aria-hidden="true" />
          <span>Accepted: <strong className="text-[var(--text)] tnum">{accepted}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--info)]" aria-hidden="true" />
          <span>On the way: <strong className="text-[var(--text)] tnum">{onTheWay}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span>Target (N): <strong className="text-[var(--text)] tnum">{unitsNeeded}</strong></span>
        </div>
      </div>
    </div>
  )
}
