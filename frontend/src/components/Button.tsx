import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'min-h-[48px] min-w-[48px] px-5 py-2.5 rounded-md font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer select-none active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-[var(--info)] focus-visible:outline-offset-2'

    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-[var(--primary)] text-[var(--primary-on)] hover:brightness-105 active:brightness-95 shadow-xs',
      secondary:
        'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--border)]/20',
      ghost:
        'bg-transparent text-[var(--text)] hover:bg-[var(--border)]/30 border border-transparent',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={clsx(baseStyles, variants[variant], className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'
