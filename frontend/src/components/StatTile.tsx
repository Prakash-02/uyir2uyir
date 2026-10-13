import type { ReactNode } from 'react'
import clsx from 'clsx'

export interface StatTileProps {
  value: ReactNode
  label: ReactNode
  baseline?: ReactNode
  trend?: 'positive' | 'negative' | 'neutral'
  className?: string
}

export function StatTile({
  value,
  label,
  baseline,
  trend = 'positive',
  className,
}: StatTileProps) {
  const trendColor = {
    positive: 'text-[var(--success)]',
    negative: 'text-[var(--danger)]',
    neutral: 'text-[var(--muted)]',
  }[trend]

  return (
    <div
      className={clsx(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xs flex flex-col justify-between text-left select-none',
        className,
      )}
    >
      <div>
        {/* Label */}
        <span className="font-heading font-semibold text-xs sm:text-sm text-[var(--muted)] tracking-wide uppercase block">
          {label}
        </span>

        {/* Big Impact Number: 44px Tabular Numerals */}
        <div className="font-heading font-bold text-3xl sm:text-[44px] sm:leading-[1.1] text-[var(--primary)] tnum mt-2">
          {value}
        </div>
      </div>

      {/* Baseline Line */}
      {baseline && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]/60 text-xs flex items-center justify-between">
          <span className="text-[var(--muted)]">Comparison:</span>
          <span className={clsx('font-medium tnum', trendColor)}>
            {baseline}
          </span>
        </div>
      )}
    </div>
  )
}
