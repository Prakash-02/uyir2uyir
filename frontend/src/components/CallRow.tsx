import type { ReactNode } from 'react'
import type { BloodGroup, CallState } from '../api/types'
import { StatusBadge } from './StatusBadge'
import { formatEta } from '../lib/time'
import { MapPin, Clock } from 'lucide-react'
import clsx from 'clsx'

export interface CallRowProps {
  donorAlias: string
  bloodGroup: BloodGroup
  state: CallState
  distanceKm: number
  etaMinutes?: number | null
  quote?: string | null
  round?: number
  action?: ReactNode
  className?: string
}

export function CallRow({
  donorAlias,
  bloodGroup,
  state,
  distanceKm,
  etaMinutes = null,
  quote = null,
  round,
  action,
  className,
}: CallRowProps) {
  return (
    <div
      className={clsx(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--info)]/40 transition-colors shadow-xs',
        className,
      )}
    >
      {/* Donor Identifier & Blood Group */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-heading font-bold text-sm tracking-tight border border-[var(--primary)]/20 shrink-0">
          {bloodGroup}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-base text-[var(--text)]">
              {donorAlias}
            </span>
            {round !== undefined && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--border)]/40 text-[var(--muted)]">
                R{round}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-0.5">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="tnum">{distanceKm.toFixed(1)} km</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="tnum font-medium text-[var(--text)]">
                {formatEta(etaMinutes)}
              </span>
            </span>
          </div>
          {quote && (
            <div className="mt-1.5 text-xs text-[var(--muted)] italic bg-[var(--surface-muted)]/60 px-2 py-0.5 rounded border border-[var(--border)]/60 max-w-sm">
              &ldquo;{quote}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Status & Action Trigger Slot */}
      <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
        <StatusBadge status={state} kind="call" />
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
