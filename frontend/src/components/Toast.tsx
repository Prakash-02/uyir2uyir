import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X, CheckCircle2, AlertCircle, Info, ShieldAlert } from 'lucide-react'
import clsx from 'clsx'

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

export interface ToastProps extends Omit<React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>, 'title'> {
  variant?: ToastVariant
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

const variantStyles: Record<ToastVariant, { border: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  info: {
    border: 'border-[var(--info)]/30',
    bg: 'bg-[var(--surface)]',
    icon: Info,
  },
  success: {
    border: 'border-[var(--success)]/40',
    bg: 'bg-[var(--surface)]',
    icon: CheckCircle2,
  },
  warning: {
    border: 'border-[var(--warning)]/40',
    bg: 'bg-[var(--surface)]',
    icon: AlertCircle,
  },
  danger: {
    border: 'border-[var(--danger)]/40',
    bg: 'bg-[var(--surface)]',
    icon: ShieldAlert,
  },
}

const variantIconColors: Record<ToastVariant, string> = {
  info: 'text-[var(--info)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  danger: 'text-[var(--danger)]',
}

export function Toast({
  variant = 'info',
  title,
  description,
  action,
  className,
  children,
  ...props
}: ToastProps) {
  const cfg = variantStyles[variant]
  const Icon = cfg.icon

  return (
    <ToastPrimitive.Root
      className={clsx(
        'relative flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all select-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        'bg-[var(--surface)] text-[var(--text)]',
        cfg.border,
        className,
      )}
      {...props}
    >
      <div className={clsx('shrink-0 mt-0.5', variantIconColors[variant])}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0 pr-6 text-left">
        {title && (
          <ToastPrimitive.Title className="font-heading font-bold text-sm text-[var(--text)]">
            {title}
          </ToastPrimitive.Title>
        )}
        {description && (
          <ToastPrimitive.Description className="text-xs text-[var(--muted)] mt-1 leading-normal">
            {description}
          </ToastPrimitive.Description>
        )}
        {children}
        {action && <div className="mt-2">{action}</div>}
      </div>

      <ToastPrimitive.Close
        aria-label="Close notification"
        className="absolute top-2 right-2 min-w-[48px] min-h-[48px] rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/30 flex items-center justify-center transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)] cursor-pointer"
      >
        <X className="w-4 h-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  )
}

export function ToastProvider({
  children,
  duration = 4000,
}: {
  children: React.ReactNode
  duration?: number
}) {
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={duration}>
      {children}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full outline-none" />
    </ToastPrimitive.Provider>
  )
}

export {
  ToastPrimitive,
}
