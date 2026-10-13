import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { DemoBanner } from './DemoBanner'
import { LangToggle } from './LangToggle'
import { ThemeToggle } from './ThemeToggle'
import {
  Building2,
  HeartHandshake,
  ShieldCheck,
  PhoneCall,
  UserPlus,
  BarChart3,
  Binary,
  Palette,
} from 'lucide-react'

export interface AppShellProps {
  children: ReactNode
  bannerText?: string
  showBanner?: boolean
}

export function AppShell({
  children,
  bannerText,
  showBanner = true,
}: AppShellProps) {
  const location = useLocation()

  const navLinks = [
    { to: '/hospital', label: 'Hospital', icon: Building2 },
    { to: '/centre', label: 'Blood Centre', icon: HeartHandshake },
    { to: '/desk', label: 'Request Desk', icon: ShieldCheck },
    { to: '/sim', label: 'Call Simulator', icon: PhoneCall },
    { to: '/join', label: 'Join as Donor', icon: UserPlus },
    { to: '/impact', label: 'Impact', icon: BarChart3 },
    { to: '/eval', label: 'AI Eval', icon: Binary },
    { to: '/styleguide', label: 'Styleguide', icon: Palette },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors">
      {showBanner && <DemoBanner text={bannerText} />}

      <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-decoration-none focus-visible:outline-3 focus-visible:outline-[var(--info)] rounded-md py-1"
            aria-label="U2U (Uyir2Uyir) Home"
          >
            <Logo size="md" />
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 py-1">
            {navLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)] ${
                    active
                      ? 'bg-[var(--info-tint)] text-[var(--info)] font-semibold'
                      : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/20'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right Controls: Lang & Theme Toggles */}
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 border-t border-[var(--border)] bg-[var(--surface)]">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`min-h-[40px] shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[var(--info-tint)] text-[var(--info)] font-semibold'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-6 text-center text-xs text-[var(--muted)] transition-colors">
        <p className="max-w-xl mx-auto px-4">
          Life passes on. Freely. Safely. In time. · Prototype for Google Cloud AI Builder Cup 2026.
          <br />
          <span className="italic mt-1 block">Nobody may charge you for a donor.</span>
        </p>
      </footer>
    </div>
  )
}
