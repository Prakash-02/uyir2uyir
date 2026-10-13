export function DeskPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--text)]">Request Desk</h1>
      <p className="text-[var(--muted)]">Paste a forwarded WhatsApp blood request to verify its authenticity.</p>
      <div className="p-6 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-sm text-[var(--muted)]">Status: planned (Message verification with Gemini Flash)</p>
      </div>
      <div className="text-xs text-[var(--muted)] italic pt-4">
        Nobody may charge you for a donor.
      </div>
    </div>
  )
}
