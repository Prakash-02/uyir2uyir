import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DemoBanner } from './DemoBanner'
import { Droplet, HeartHandshake, ShieldCheck, PhoneCall, Building2, UserPlus, BarChart3, Binary } from 'lucide-react'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'Home', icon: Droplet },
    { to: '/hospital', label: 'Hospital', icon: Building2 },
    { to: '/centre', label: 'Blood Centre', icon: HeartHandshake },
    { to: '/desk', label: 'Request Desk', icon: ShieldCheck },
    { to: '/sim', label: 'Call Simulator', icon: PhoneCall },
    { to: '/join', label: 'Join as Donor', icon: UserPlus },
    { to: '/impact', label: 'Impact', icon: BarChart3 },
    { to: '/eval', label: 'AI Eval', icon: Binary },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <DemoBanner />
      <header className="border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-decoration-none group">
            <div className="flex items-center text-[var(--primary)] font-bold text-2xl tracking-tight">
              <span>U</span>
              <span className="text-[var(--primary)]">2</span>
              <span>U</span>
            </div>
            <div className="flex flex-col text-xs leading-none">
              <span className="font-semibold text-[var(--text)]">Uyir2Uyir</span>
              <span className="text-[10px] text-[var(--muted)] font-medium">உயிர்</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 overflow-x-auto py-1">
            {navLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[var(--info-tint)] text-[var(--info)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-4 text-center text-xs text-[var(--muted)]">
        <p>Life passes on. Freely. Safely. In time. · Prototype for Google Cloud AI Builder Cup 2026</p>
      </footer>
    </div>
  )
}
