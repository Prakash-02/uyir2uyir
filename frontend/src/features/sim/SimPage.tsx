export function SimPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--text)]">Call Simulator</h1>
      <p className="text-[var(--muted)]">Simulate IVR donor phone calls with audio prompts and keypad responses.</p>
      <div className="p-6 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-sm text-[var(--muted)]">Status: planned (Interactive phone frame with keys 1, 2, 9)</p>
      </div>
    </div>
  )
}
