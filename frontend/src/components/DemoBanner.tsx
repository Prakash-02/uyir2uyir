import clsx from 'clsx'

export interface DemoBannerProps {
  text?: string
  className?: string
}

export function DemoBanner({
  text = 'SIMULATED DATA — All hospitals, donors and patients shown are simulated.',
  className,
}: DemoBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'sticky top-0 z-50 w-full bg-[var(--demo)] text-[#1C1917] px-4 py-1.5 text-center text-xs sm:text-sm font-bold tracking-wide uppercase shadow-xs select-none',
        className,
      )}
    >
      {text}
    </div>
  )
}
