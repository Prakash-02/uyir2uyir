import { useParams } from 'react-router-dom'

export function ConfirmPage() {
  const { token } = useParams<{ token: string }>()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--text)]">Confirm Hospital Request</h1>
      <p className="text-[var(--muted)]">Review extracted blood request details and confirm dispatch.</p>
      <div className="p-6 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-sm text-[var(--muted)]">
          Token: <span className="font-mono">{token ?? 'missing'}</span>
        </p>
        <p className="text-sm text-[var(--muted)] mt-2">Status: planned (Single-use token preview)</p>
      </div>
    </div>
  )
}
