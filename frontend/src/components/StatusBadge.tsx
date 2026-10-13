import type { ComponentType } from 'react'
import type { RequestStatus, CallState } from '../api/types'
import {
  Radio,
  PauseCircle,
  CheckCircle2,
  Hourglass,
  Clock,
  XCircle,
  PhoneOutgoing,
  Navigation,
  UserCheck,
  CalendarClock,
  PhoneMissed,
  Ban,
  Heart,
  ShieldCheck,
  Send,
  ShieldAlert,
  PhoneOff,
} from 'lucide-react'
import clsx from 'clsx'

export type DeskAnswer = 'VERIFIED_MATCH' | 'SENT_TO_HOSPITAL' | 'NOT_VERIFIED'

export type BadgeStatus = RequestStatus | CallState | DeskAnswer

interface StatusConfig {
  label: string
  icon: ComponentType<{ className?: string }>
  colorClass: string
  isPulse?: boolean
}

const statusConfigs: Record<BadgeStatus, StatusConfig> = {
  // RequestStatus
  OPEN: {
    label: 'Calling donors',
    icon: Radio,
    colorClass: 'bg-[var(--info-tint)] text-[var(--info)] border-[var(--info)]/30',
  },
  PAUSED: {
    label: 'Enough on the way',
    icon: PauseCircle,
    colorClass: 'bg-[var(--warning-tint)] text-[var(--warning)] border-[var(--warning)]/30',
  },
  FULFILLED: {
    label: 'Fulfilled',
    icon: CheckCircle2,
    colorClass: 'bg-[var(--success-tint)] text-[var(--success)] border-[var(--success)]/30',
  },
  AWAITING_HOSPITAL: {
    label: 'Waiting for hospital',
    icon: Hourglass,
    colorClass: 'bg-[var(--warning-tint)] text-[var(--warning)] border-[var(--warning)]/30',
  },
  EXPIRED: {
    label: 'Expired',
    icon: Clock,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
  },

  // CallState
  QUEUED: {
    label: 'Queued',
    icon: PhoneOutgoing,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
  },
  DIALING: {
    label: 'Dialing',
    icon: PhoneOutgoing,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
  },
  RINGING: {
    label: 'Ringing',
    icon: PhoneOutgoing,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
    isPulse: true,
  },
  ON_THE_WAY: {
    label: 'On the way',
    icon: Navigation,
    colorClass: 'bg-[var(--success-tint)] text-[var(--success)] border-[var(--success)]/30',
  },
  ACCEPTED: {
    label: 'Accepted',
    icon: UserCheck,
    colorClass: 'bg-[var(--success-tint)] text-[var(--success)] border-[var(--success)]/30',
  },
  DEFERRED: {
    label: 'Deferred',
    icon: CalendarClock,
    colorClass: 'bg-[var(--warning-tint)] text-[var(--warning)] border-[var(--warning)]/30',
  },
  DECLINED: {
    label: 'Declined',
    icon: PhoneMissed,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
  },
  NO_ANSWER: {
    label: 'No answer',
    icon: PhoneMissed,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
  },
  UNKNOWN: {
    label: 'Unknown',
    icon: PhoneMissed,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
  },
  OPTED_OUT: {
    label: 'Opted out',
    icon: Ban,
    colorClass: 'bg-[var(--danger-tint)] text-[var(--danger)] border-[var(--danger)]/30',
  },
  LATE_ACCEPT: {
    label: 'Thanked',
    icon: Heart,
    colorClass: 'bg-[var(--info-tint)] text-[var(--info)] border-[var(--info)]/30',
  },

  // DeskAnswer
  VERIFIED_MATCH: {
    label: 'Verified match',
    icon: ShieldCheck,
    colorClass: 'bg-[var(--success-tint)] text-[var(--success)] border-[var(--success)]/30',
  },
  SENT_TO_HOSPITAL: {
    label: 'Sent to hospital',
    icon: Send,
    colorClass: 'bg-[var(--warning-tint)] text-[var(--warning)] border-[var(--warning)]/30',
  },
  NOT_VERIFIED: {
    label: "Couldn't verify",
    icon: ShieldAlert,
    colorClass: 'bg-[var(--danger-tint)] text-[var(--danger)] border-[var(--danger)]/30',
  },
}

export interface StatusBadgeProps {
  status: BadgeStatus
  kind?: 'request' | 'call' | 'desk'
  className?: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, kind, className, size = 'md' }: StatusBadgeProps) {
  // Safe fallback if an unexpected status is passed
  const baseConfig = statusConfigs[status] ?? {
    label: String(status),
    icon: Clock,
    colorClass: 'bg-[var(--border)]/40 text-[var(--muted)] border-[var(--border)]',
  }

  // If CANCELLED is for a donor call, use PhoneOff per design system table 3.2
  const IconComponent = kind === 'call' && status === 'CANCELLED' ? PhoneOff : baseConfig.icon
  const config = baseConfig

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold rounded-full border border-solid select-none tracking-tight',
        config.colorClass,
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs sm:text-sm',
        className,
      )}
    >
      <IconComponent
        className={clsx(
          'shrink-0',
          size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
          config.isPulse && 'animate-pulse text-[var(--info)]',
        )}
        aria-hidden="true"
      />
      <span>{config.label}</span>
    </span>
  )
}
