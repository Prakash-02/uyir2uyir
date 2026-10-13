import type { SimKey } from '../api/types'
import clsx from 'clsx'

export interface KeypadProps {
  onPressKey: (key: SimKey) => void
  disabled?: boolean
  activeKey?: SimKey | null
  className?: string
}

interface KeyConfig {
  key: SimKey
  labelEn: string
  labelTa: string
  meaning: string
  colorVariant: 'success' | 'muted' | 'danger'
}

const keyConfigs: KeyConfig[] = [
  {
    key: '1',
    labelEn: 'Coming',
    labelTa: 'வருகிறேன்',
    meaning: 'Accept & on the way',
    colorVariant: 'success',
  },
  {
    key: '2',
    labelEn: "Can't",
    labelTa: 'இயலாது',
    meaning: 'Decline for now',
    colorVariant: 'muted',
  },
  {
    key: '9',
    labelEn: 'Opt out',
    labelTa: 'விலகுகிறேன்',
    meaning: 'Remove from pool',
    colorVariant: 'danger',
  },
]

export function Keypad({
  onPressKey,
  disabled = false,
  activeKey,
  className,
}: KeypadProps) {
  const variantStyles: Record<KeyConfig['colorVariant'], string> = {
    success:
      'border-[var(--success)]/40 hover:border-[var(--success)] hover:bg-[var(--success-tint)] text-[var(--success)]',
    muted:
      'border-[var(--border)] hover:border-[var(--muted)] hover:bg-[var(--border)]/20 text-[var(--muted)]',
    danger:
      'border-[var(--danger)]/40 hover:border-[var(--danger)] hover:bg-[var(--danger-tint)] text-[var(--danger)]',
  }

  const activeStyles: Record<KeyConfig['colorVariant'], string> = {
    success: 'bg-[var(--success)] !text-[var(--surface)] ring-4 ring-[var(--success)]/30',
    muted: 'bg-[var(--muted)] !text-[var(--surface)] ring-4 ring-[var(--muted)]/30',
    danger: 'bg-[var(--danger)] !text-[var(--surface)] ring-4 ring-[var(--danger)]/30',
  }

  return (
    <div
      role="group"
      aria-label="Telephone simulation keypad (keys 1, 2, 9)"
      className={clsx('grid grid-cols-3 gap-3 sm:gap-4 max-w-md mx-auto', className)}
    >
      {keyConfigs.map((cfg) => {
        const isActive = activeKey === cfg.key
        return (
          <button
            key={cfg.key}
            type="button"
            disabled={disabled}
            onClick={() => onPressKey(cfg.key)}
            aria-label={`Digit ${cfg.key}: ${cfg.labelEn} (${cfg.labelTa}) - ${cfg.meaning}`}
            className={clsx(
              'min-h-[80px] sm:min-h-[96px] p-3 rounded-2xl border-2 bg-[var(--surface)] transition-all cursor-pointer select-none',
              'flex flex-col items-center justify-center gap-1 active:scale-95',
              'focus-visible:outline-3 focus-visible:outline-[var(--info)] focus-visible:outline-offset-2',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
              variantStyles[cfg.colorVariant],
              isActive && activeStyles[cfg.colorVariant],
            )}
          >
            {/* Big Digits in Tabular Anek Tamil */}
            <span className="font-heading font-bold text-3xl sm:text-4xl text-[var(--text)] tnum leading-none">
              {cfg.key}
            </span>

            {/* Label in English */}
            <span className="text-xs sm:text-sm font-bold tracking-tight leading-tight">
              {cfg.labelEn}
            </span>

            {/* Tamil Label */}
            <span lang="ta" className="text-[11px] font-medium opacity-80 leading-none">
              {cfg.labelTa}
            </span>
          </button>
        )
      })}
    </div>
  )
}
