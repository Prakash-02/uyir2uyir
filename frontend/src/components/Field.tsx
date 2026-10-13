import { forwardRef } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

export interface FieldProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={clsx('space-y-1.5 text-left', className)}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block font-heading font-semibold text-sm text-[var(--text)] select-none"
        >
          {label}
          {required && <span className="text-[var(--danger)] ml-1" aria-hidden="true">*</span>}
        </label>
      </div>

      {children}

      {hint && (
        <p id={hintId} className="text-xs text-[var(--muted)]">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-xs font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// Pre-styled Input component
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={hasError ? true : undefined}
        className={clsx(
          'w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border text-sm transition-colors',
          'bg-[var(--surface)] text-[var(--text)] border-[var(--border)]',
          'placeholder:text-[var(--muted)]/60',
          'focus-visible:outline-3 focus-visible:outline-[var(--info)] focus-visible:outline-offset-2',
          hasError && 'border-[var(--danger)] focus-visible:outline-[var(--danger)]',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

// Pre-styled Select component
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={hasError ? true : undefined}
        className={clsx(
          'w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border text-sm transition-colors cursor-pointer',
          'bg-[var(--surface)] text-[var(--text)] border-[var(--border)]',
          'focus-visible:outline-3 focus-visible:outline-[var(--info)] focus-visible:outline-offset-2',
          hasError && 'border-[var(--danger)] focus-visible:outline-[var(--danger)]',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'

// Pre-styled Textarea component
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={hasError ? true : undefined}
        className={clsx(
          'w-full min-h-[120px] p-3.5 rounded-lg border text-sm transition-colors resize-y',
          'bg-[var(--surface)] text-[var(--text)] border-[var(--border)]',
          'placeholder:text-[var(--muted)]/60',
          'focus-visible:outline-3 focus-visible:outline-[var(--info)] focus-visible:outline-offset-2',
          hasError && 'border-[var(--danger)] focus-visible:outline-[var(--danger)]',
          className,
        )}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'
