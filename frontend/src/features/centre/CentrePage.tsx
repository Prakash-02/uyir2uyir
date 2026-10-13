export function CentrePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--text)]">Blood Centre Dashboard</h1>
      <p className="text-[var(--muted)]">Manage arriving donors, accept or defer donations, and monitor rounds.</p>
      <div className="p-6 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-sm text-[var(--muted)]">Status: planned (Donor triage list and live timeline)</p>
      </div>
    </div>
  )
}
