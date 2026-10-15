import { useState, useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { DemoBanner } from './DemoBanner'
import { DemoRolePicker } from './DemoRolePicker'
import { LangToggle } from './LangToggle'
import { ThemeToggle } from './ThemeToggle'
import { useT } from '../i18n/useT'
import {
  Building2,
  HeartHandshake,
  ShieldCheck,
  UserPlus,
  BarChart3,
  PhoneCall,
  Binary,
  Palette,
  GitBranch,
  WifiOff,
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
  const { t } = useT()

  // Step 2: Offline banner detection using navigator.onLine and event listeners
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Primary 5 required nav links
  const primaryNavLinks = [
    { to: '/hospital', label: t.nav.hospital, icon: Building2 },
    { to: '/centre', label: t.nav.centre, icon: HeartHandshake },
    { to: '/desk', label: t.nav.desk, icon: ShieldCheck },
    { to: '/join', label: t.nav.join, icon: UserPlus },
    { to: '/impact', label: t.nav.impact, icon: BarChart3 },
  ]

  // Secondary demo / inspection links
  const secondaryNavLinks = [
    { to: '/sim', label: t.nav.sim, icon: PhoneCall },
    { to: '/eval', label: t.nav.eval, icon: Binary },
    { to: '/styleguide', label: t.nav.styleguide, icon: Palette },
  ]

  const allNavLinks = [...primaryNavLinks, ...secondaryNavLinks]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors">
      {/* Offline Status Alert Banner */}
      {!isOnline && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-[var(--danger)] text-white px-4 py-2.5 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 select-none z-50 sticky top-0 shadow-xs"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t.offline.message}</span>
        </div>
      )}

      {showBanner && <DemoBanner text={bannerText} />}

      <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-40 transition-colors shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="min-h-[48px] min-w-[48px] flex items-center gap-2 text-decoration-none focus-visible:outline-3 focus-visible:outline-[var(--info)] rounded-md py-1"
            aria-label="U2U (Uyir2Uyir) Home"
          >
            <Logo size="md" />
          </Link>

          {/* Primary Navigation Links (Desktop: 48px touch targets) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-1 py-1"
          >
            {primaryNavLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`min-h-[48px] flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)] ${
                    active
                      ? 'bg-[var(--info-tint)] text-[var(--info)] font-bold'
                      : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/20'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              )
            })}

            {/* Separator before demo tools */}
            <div className="h-5 w-px bg-[var(--border)] mx-1" aria-hidden="true" />

            {/* Secondary inspection links (Desktop: 48px touch targets) */}
            {secondaryNavLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`min-h-[48px] flex items-center gap-1 px-2.5 py-2 rounded-md text-xs font-medium transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)] ${
                    active
                      ? 'bg-[var(--info-tint)] text-[var(--info)] font-bold'
                      : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/20'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right Controls: Lang & Theme Toggles (48px tap targets) */}
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile Navigation bar (360px width, 48px touch targets, horizontal scroll) */}
        <div className="lg:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 border-t border-[var(--border)] bg-[var(--surface)]">
          {allNavLinks.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`min-h-[48px] shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)] ${
                  active
                    ? 'bg-[var(--info-tint)] text-[var(--info)] font-bold'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <DemoRolePicker />
        {children}
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-8 text-center text-xs text-[var(--muted)] transition-colors">
        <div className="max-w-2xl mx-auto px-4 space-y-3">
          <p className="font-semibold text-sm text-[var(--text)]">
            {t.footer.prototype}
          </p>
          <p className="italic text-[var(--primary)] font-semibold text-sm">
            {t.footer.mandatory}
          </p>
          <div className="flex items-center justify-center gap-4 pt-2 text-xs">
            <a
              href="https://github.com/Prakash-02/uyir2uyir"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--text)] transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)] rounded-xs py-1"
            >
              <GitBranch className="w-4 h-4" aria-hidden="true" />
              <span>{t.footer.github}</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AppShell
