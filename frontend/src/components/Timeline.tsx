import type { TimelineEvent } from '../api/types'
import {
  PhoneOutgoing,
  PhoneCall,
  UserCheck,
  PauseCircle,
  AlertCircle,
  Clock,
  Radio,
  CheckCircle2,
} from 'lucide-react'
import clsx from 'clsx'

export interface TimelineProps {
  events: TimelineEvent[]
  className?: string
  maxItems?: number
  emptyMessage?: string
}

function getEventIcon(kind: string) {
  const upper = kind.toUpperCase()
  if (upper.includes('DISPATCH') || upper.includes('DIAL')) return PhoneOutgoing
  if (upper.includes('IVR') || upper.includes('CALL')) return PhoneCall
  if (upper.includes('ACCEPT') || upper.includes('CONFIRM')) return UserCheck
  if (upper.includes('PAUSE')) return PauseCircle
  if (upper.includes('FULFILL')) return CheckCircle2
  if (upper.includes('ALERT') || upper.includes('WARNING')) return AlertCircle
  if (upper.includes('ROUND') || upper.includes('OPEN')) return Radio
  return Clock
}

function formatEventTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  } catch {
    return isoString
  }
}

export function Timeline({
  events,
  className,
  maxItems,
  emptyMessage = 'No dispatch events recorded yet.',
}: TimelineProps) {
  const displayEvents = maxItems ? events.slice(0, maxItems) : events

  if (displayEvents.length === 0) {
    return (
      <div
        role="log"
        aria-live="polite"
        className={clsx(
          'p-8 text-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-sm select-none',
          className,
        )}
      >
        <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" aria-hidden="true" />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div
      role="log"
      aria-live="polite"
      className={clsx(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-hidden shadow-xs',
        className,
      )}
    >
      {displayEvents.map((ev) => {
        const Icon = getEventIcon(ev.kind)
        return (
          <div
            key={ev.id}
            className="flex items-start gap-3 p-3.5 sm:p-4 text-sm hover:bg-[var(--border)]/10 transition-opacity duration-150 ease-in-out"
            style={{ animation: 'fadeIn 150ms ease-out' }}
          >
            {/* Timestamp Chip */}
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--border)]/40 text-[var(--muted)] font-mono text-xs tnum select-none">
              {formatEventTime(ev.at)}
            </span>

            {/* Event Icon */}
            <div className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-[var(--info-tint)] text-[var(--info)] flex items-center justify-center">
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            </div>

            {/* Event Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[var(--text)] font-medium leading-snug break-words">
                {ev.text}
              </p>
              {ev.kind && (
                <span className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-mono mt-0.5 block">
                  {ev.kind}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
