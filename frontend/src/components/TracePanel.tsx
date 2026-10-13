import { useState, useMemo } from 'react'
import type { DeskResult } from '../api/types'
import { ChevronDown, ChevronUp, Bot, ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import clsx from 'clsx'

export interface TracePanelProps {
  trace: DeskResult['trace']
  rawText?: string
  className?: string
  defaultOpen?: boolean
}

export function TracePanel({
  trace,
  rawText,
  className,
  defaultOpen = false,
}: TracePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Map of quoted fields for quick iteration
  const fields = useMemo(() => [
    { label: 'Hospital Name', field: trace.hospital },
    { label: 'Patient Number', field: trace.patientNumber },
    { label: 'Blood Group', field: trace.bloodGroup },
    { label: 'Component', field: trace.component },
    { label: 'Units Needed', field: trace.units },
  ], [trace])

  return (
    <div
      className={clsx(
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs text-left',
        className,
      )}
    >
      {/* Drawer Toggle Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="trace-content"
        className="w-full min-h-[48px] px-4 py-3 bg-[var(--border)]/15 hover:bg-[var(--border)]/30 flex items-center justify-between text-sm font-semibold text-[var(--text)] transition-colors cursor-pointer select-none focus-visible:outline-3 focus-visible:outline-[var(--info)]"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[var(--info)] shrink-0" aria-hidden="true" />
          <span>Gemini & Code Verification Trace</span>
          <span className="text-xs font-mono font-normal text-[var(--muted)] px-2 py-0.5 rounded bg-[var(--border)]/30">
            {trace.codeDecision}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-[var(--muted)]" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--muted)]" aria-hidden="true" />
        )}
      </button>

      {/* Drawer Content */}
      {isOpen && (
        <div id="trace-content" className="p-4 sm:p-5 space-y-5 text-sm">
          {/* Decision Path Callout: Gemini Proposes vs Code Decides */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[var(--info)]/30 bg-[var(--info-tint)]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--info)] uppercase tracking-wider mb-1">
                <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Gemini Flash Extraction</span>
              </div>
              <div className="font-mono text-xs text-[var(--text)] font-semibold break-words">
                {trace.geminiChoice}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[var(--success)]/30 bg-[var(--success-tint)]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--success)] uppercase tracking-wider mb-1">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Deterministic Code Decision</span>
              </div>
              <div className="font-mono text-xs text-[var(--text)] font-semibold break-words">
                {trace.codeDecision}
              </div>
            </div>
          </div>

          {/* Original Text with Highlights */}
          {rawText && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5 font-heading">
                Forwarded Message Text Analysis
              </h4>
              <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] font-sans text-xs leading-relaxed text-[var(--text)] whitespace-pre-wrap break-words">
                {rawText}
              </div>
            </div>
          )}

          {/* Quoted Fields Matrix */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2 font-heading">
              Extracted Quotes Verification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {fields.map(({ label, field }) => (
                <div
                  key={label}
                  className="p-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-[var(--muted)] font-medium block">{label}</span>
                    <span className="font-mono font-semibold text-[var(--text)] block truncate">
                      {field.value !== null && field.value !== undefined ? String(field.value) : '—'}
                    </span>
                    {field.quote && (
                      <span
                        className={clsx(
                          'font-mono text-[11px] mt-0.5 inline-block px-1.5 py-0.5 rounded',
                          field.kept
                            ? 'bg-[var(--success-tint)] text-[var(--success)] border border-[var(--success)]/20'
                            : 'bg-[var(--danger-tint)] text-[var(--danger)] line-through border border-[var(--danger)]/20',
                        )}
                      >
                        &quot;{field.quote}&quot;
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 mt-0.5">
                    {field.kept ? (
                      <span className="inline-flex items-center gap-1 text-[var(--success)] text-[11px] font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Kept</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--danger)] text-[11px] font-semibold">
                        <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Dropped</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Phrases Detection */}
          {trace.paymentPhrases && trace.paymentPhrases.length > 0 && (
            <div className="p-3 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-tint)] text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[var(--danger)] mb-1">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Remuneration / Scam Language Detected</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {trace.paymentPhrases.map((phrase, idx) => (
                  <span
                    key={idx}
                    className="font-mono px-2 py-0.5 rounded bg-[var(--danger)] text-white font-semibold"
                  >
                    &quot;{phrase}&quot;
                  </span>
                ))}
              </div>
              <p className="text-[var(--danger)] mt-1.5 font-medium">
                Requests soliciting or offering remuneration are strictly denied outreach per Indian National Blood Transfusion Council regulations.
              </p>
            </div>
          )}

          {/* Mandatory Safety Guardrail Note */}
          <div className="text-[11px] text-[var(--muted)] border-t border-[var(--border)] pt-2 italic">
            Gemini Flash extracts and quotes fields, but deterministic code validates every quote verbatim. Gemini never decides request status, match validity, or donor eligibility.
          </div>
        </div>
      )}
    </div>
  )
}
