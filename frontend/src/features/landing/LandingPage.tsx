export function LandingPage() {
  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)] mb-3">
          U2U · Urgent Blood Relay
        </h1>
        <p className="text-lg text-[var(--muted)] leading-relaxed">
          Relaying urgent blood requests from verified hospitals to nearby consented donors via automated phone calls, with a public Request Desk to verify forwarded messages.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="p-5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <h2 className="font-semibold text-lg text-[var(--primary)] mb-2">Freely</h2>
          <p className="text-sm text-[var(--muted)]">Life is given, never sold. Every answer ends with &ldquo;Nobody may charge you for a donor.&rdquo;</p>
        </div>
        <div className="p-5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <h2 className="font-semibold text-lg text-[var(--primary)] mb-2">Safely</h2>
          <p className="text-sm text-[var(--muted)]">Only real requests from verified hospitals. Blood centre staff decide donor eligibility.</p>
        </div>
        <div className="p-5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <h2 className="font-semibold text-lg text-[var(--primary)] mb-2">In time</h2>
          <p className="text-sm text-[var(--muted)]">Calls 5 donors at a time in Tamil or English until the request is covered.</p>
        </div>
      </div>
    </div>
  )
}
