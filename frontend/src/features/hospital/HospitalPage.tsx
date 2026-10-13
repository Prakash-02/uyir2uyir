export function HospitalPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--text)]">Hospital Blood Request</h1>
      <p className="text-[var(--muted)]">Raise an urgent blood request for verified patient needs.</p>
      <div className="p-6 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-sm text-[var(--muted)]">Status: planned (Form and live progress banner)</p>
      </div>
    </div>
  )
}
