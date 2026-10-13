import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import clsx from 'clsx'

export interface ConsentCheckboxProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  required?: boolean
  error?: ReactNode
  className?: string
}

export function ConsentCheckbox({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  required = false,
  error,
  className,
}: ConsentCheckboxProps) {
  return (
    <div className={clsx('text-left', className)}>
      <label
        htmlFor={id}
        className={clsx(
          'min-h-[48px] flex items-start gap-3 p-3 rounded-lg border transition-colors select-none cursor-pointer',
          checked
            ? 'border-[var(--primary)] bg-[var(--surface)]'
            : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--border)]/10',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          error && 'border-[var(--danger)]',
        )}
      >
        {/* Custom Checkbox Box */}
        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            required={required}
            className="peer sr-only"
            aria-invalid={error ? true : undefined}
            aria-describedby={description ? `${id}-desc` : undefined}
          />
          <div
            className={clsx(
              'w-5 h-5 rounded border transition-all flex items-center justify-center',
              'peer-focus-visible:outline-3 peer-focus-visible:outline-[var(--info)] peer-focus-visible:outline-offset-2',
              checked
                ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-on)]'
                : 'border-[var(--border)] bg-[var(--surface)]',
            )}
            aria-hidden="true"
          >
            {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
        </div>

        {/* Text Label & Description */}
        <div className="flex-1 text-sm leading-normal">
          <div className="font-medium text-[var(--text)]">
            {label}
            {required && <span className="text-[var(--danger)] ml-1" aria-hidden="true">*</span>}
          </div>
          {description && (
            <div id={`${id}-desc`} className="text-xs text-[var(--muted)] mt-1">
              {description}
            </div>
          )}
        </div>
      </label>

      {error && (
        <p className="text-xs font-semibold text-[var(--danger)] mt-1.5 ml-1" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
