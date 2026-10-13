import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="text-center py-12 space-y-4">
      <h1 className="text-3xl font-bold text-[var(--danger)]">404 · Page Not Found</h1>
      <p className="text-[var(--muted)]">The requested route does not exist.</p>
      <Link
        to="/"
        className="inline-block mt-4 px-4 py-2 rounded-md bg-[var(--primary)] text-[var(--primary-on)] font-medium text-sm hover:opacity-90 transition-opacity"
      >
        Return to Home
      </Link>
    </div>
  )
}
