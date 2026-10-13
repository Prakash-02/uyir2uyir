import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] p-5 sm:p-6 shadow-xs',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'

export interface CardHeaderProps {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
  children?: ReactNode
}

export function CardHeader({ title, subtitle, action, className, children }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 mb-4', className)}>
      <div>
        {title && <h3 className="font-heading font-bold text-lg text-[var(--text)]">{title}</h3>}
        {subtitle && <p className="text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
