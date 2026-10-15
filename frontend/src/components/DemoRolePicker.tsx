import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Building2, HeartHandshake, CheckCircle2, Loader2, LogOut, ShieldAlert } from 'lucide-react'
import { signInDemoRole, signOutCurrentUser, onAuthChange, type User } from '../lib/firebase'
import { useT } from '../i18n/useT'

export interface DemoRolePickerProps {
  className?: string
}

export function DemoRolePicker({ className = '' }: DemoRolePickerProps) {
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [loadingRole, setLoadingRole] = useState<'hospital' | 'staff' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Only render on landing page /
  const isLanding = location.pathname === '/'

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setCurrentUser(user)
      if (typeof window !== 'undefined') {
        const storedRole = localStorage.getItem('u2u_demo_role')
        setActiveRole(storedRole)
      }
    })
    return () => unsub()
  }, [])

  if (!isLanding) {
    return null
  }

  const handleSelectRole = async (role: 'hospital' | 'staff') => {
    if (loadingRole) return
    setLoadingRole(role)
    setErrorMessage(null)

    try {
      await signInDemoRole(role)
      setActiveRole(role)
      // Navigate to corresponding view
      if (role === 'hospital') {
        navigate('/hospital')
      } else {
        navigate('/centre')
      }
    } catch (err) {
      console.error(`Failed to sign in with demo role ${role}:`, err)
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to sign in. Please try again.',
      )
    } finally {
      setLoadingRole(null)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOutCurrentUser()
      setActiveRole(null)
    } catch (err) {
      console.warn('Sign out error:', err)
    }
  }

  return (
    <section
      aria-label="Demo Role Switcher"
      className={`my-6 p-4 sm:p-6 bg-[var(--surface)] border-2 border-[var(--demo)] rounded-xl shadow-md transition-colors ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[var(--demo)] text-[#1C1917] px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider">
              Demo Access
            </span>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text)] m-0">
              Select Demo Role (Anonymous Auth)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 mb-0">
            Sign in with one-click Firebase anonymous authentication. In demo mode, custom claims are securely assigned by the backend with no passwords.
          </p>
        </div>

        {activeRole && currentUser && (
          <div className="flex items-center gap-2 shrink-0 bg-[var(--surface-sunken)] px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" aria-hidden="true" />
            <span>
              Active: <strong className="capitalize">{activeRole === 'staff' ? 'Blood centre' : activeRole}</strong>
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-2 text-[var(--muted)] hover:text-[var(--danger)] cursor-pointer p-1 rounded transition-colors focus-visible:outline-2 focus-visible:outline-[var(--danger)]"
              aria-label="Sign out demo role"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-3 p-3 bg-red-500/10 border border-red-500/30 text-[var(--danger)] text-xs rounded-lg flex items-center gap-2"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Hospital Demo Button */}
        <button
          type="button"
          onClick={() => handleSelectRole('hospital')}
          disabled={loadingRole !== null}
          aria-label="Sign in as Hospital Blood Bank demo user and open /hospital"
          className={`min-h-[52px] px-4 py-3 rounded-lg border font-bold text-sm flex items-center justify-between gap-3 transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-[var(--info)] ${
            activeRole === 'hospital'
              ? 'bg-[var(--info-tint)] text-[var(--info)] border-[var(--info)] shadow-xs'
              : 'bg-[var(--surface-sunken)] hover:bg-[var(--border)]/30 text-[var(--text)] border-[var(--border)]'
          }`}
        >
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-[var(--surface)] rounded-md border border-[var(--border)] text-[var(--info)] shrink-0">
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-bold">Hospital demo</div>
              <div className="text-xs text-[var(--muted)] font-normal">
                {t.nav.hospital} · Sample General Hospital
              </div>
            </div>
          </div>
          {loadingRole === 'hospital' ? (
            <Loader2 className="w-5 h-5 animate-spin text-[var(--info)] shrink-0" aria-hidden="true" />
          ) : activeRole === 'hospital' ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--info)] text-white shrink-0">
              Current
            </span>
          ) : (
            <span className="text-xs text-[var(--muted)] shrink-0">Sign in →</span>
          )}
        </button>

        {/* Blood Centre Demo Button */}
        <button
          type="button"
          onClick={() => handleSelectRole('staff')}
          disabled={loadingRole !== null}
          aria-label="Sign in as Blood Centre Staff demo user and open /centre"
          className={`min-h-[52px] px-4 py-3 rounded-lg border font-bold text-sm flex items-center justify-between gap-3 transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-[var(--info)] ${
            activeRole === 'staff'
              ? 'bg-[var(--info-tint)] text-[var(--info)] border-[var(--info)] shadow-xs'
              : 'bg-[var(--surface-sunken)] hover:bg-[var(--border)]/30 text-[var(--text)] border-[var(--border)]'
          }`}
        >
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-[var(--surface)] rounded-md border border-[var(--border)] text-[var(--primary)] shrink-0">
              <HeartHandshake className="w-5 h-5 text-[var(--primary)]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-bold">Blood centre demo</div>
              <div className="text-xs text-[var(--muted)] font-normal">
                {t.nav.centre} · Chennai Central Blood Centre
              </div>
            </div>
          </div>
          {loadingRole === 'staff' ? (
            <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)] shrink-0" aria-hidden="true" />
          ) : activeRole === 'staff' ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--info)] text-white shrink-0">
              Current
            </span>
          ) : (
            <span className="text-xs text-[var(--muted)] shrink-0">Sign in →</span>
          )}
        </button>
      </div>
    </section>
  )
}
