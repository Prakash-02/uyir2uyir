interface LogoProps {
  className?: string
  showWordmark?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ className = '', showWordmark = true, size = 'md' }: LogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  }

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  }

  const subtextSizes = {
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs',
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Two drops leaning toward each other forming a small heart at overlap */}
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes[size]} shrink-0`}
        aria-hidden="true"
      >
        {/* Left drop: filled with --primary, leaning right */}
        <path
          d="M21 7C21 7 12 18 12 28C12 34.6274 17.3726 40 24 40C25.5 40 26.8 39.7 28 39.2C24.5 37 22.5 33 22.5 28.5C22.5 21 27 15 27 15L21 7Z"
          fill="var(--primary)"
        />

        {/* Right drop: outline, leaning left */}
        <path
          d="M27 7C27 7 36 18 36 28C36 34.6274 30.6274 40 24 40C22.5 40 21.2 39.7 20 39.2C23.5 37 25.5 33 25.5 28.5C25.5 21 21 15 21 15L27 7Z"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Small heart at the intersection */}
        <path
          d="M24 33C24 33 20.5 30 20.5 27.5C20.5 25.8 21.8 24.5 23.2 24.5C23.7 24.5 24.2 24.8 24 25.2C23.8 24.8 24.3 24.5 24.8 24.5C26.2 24.5 27.5 25.8 27.5 27.5C27.5 30 24 33 24 33Z"
          fill="#FFFFFF"
        />
      </svg>

      {showWordmark && (
        <div className="flex flex-col leading-none select-none">
          <div className={`font-bold tracking-tight font-heading ${textSizes[size]}`}>
            <span className="text-[var(--text)]">U</span>
            <span className="text-[var(--primary)]">2</span>
            <span className="text-[var(--text)]">U</span>
          </div>
          <span className={`text-[var(--muted)] font-medium tracking-wide ${subtextSizes[size]}`}>
            உயிர்
          </span>
        </div>
      )}
    </div>
  )
}
