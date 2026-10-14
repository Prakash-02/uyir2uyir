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

/**
 * Splits rawText into segments, highlighting occurrences of kept quotes.
 */
function renderHighlightedText(rawText: string, keptQuotes: string[]) {
  if (!keptQuotes.length || !rawText) {
    return <span>{rawText}</span>
  }

  // Deduplicate and sort quotes by descending length to match longer substrings first
  const uniqueQuotes = Array.from(new Set(keptQuotes)).filter(Boolean)
  if (!uniqueQuotes.length) {
    return <span>{rawText}</span>
  }

  // Escape special regex characters in quotes
  const escapedQuotes = uniqueQuotes.map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escapedQuotes.join('|')})`, 'gi')

  const parts = rawText.split(regex)

  return (
    <span>
      {parts.map((part, index) => {
        const isMatch = uniqueQuotes.some((q) => q.toLowerCase() === part.toLowerCase())
        if (isMatch) {
          return (
            <mark
              key={index}
              className="bg-[var(--success-tint)] text-[var(--success)] font-semibold px-1 py-0.5 rounded border border-[var(--success)]/40 shadow-2xs"
            >
              {part}
            </mark>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </span>
  )
}

export function TracePanel({
  trace,
  rawText,
  className,
  defaultOpen = false,
}: TracePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Map of quoted fields for matrix
  const fields = useMemo(
    () => [
      { label: 'Hospital Name', field: trace.hospital },
      { label: 'Patient Number', field: trace.patientNumber },
      { label: 'Blood Group', field: trace.bloodGroup },
      { label: 'Component', field: trace.component },
      { label: 'Units Needed', field: trace.units },
    ],
    [trace],
  )

  // Collect kept quotes for highlighting
  const keptQuotes = useMemo(() => {
    return fields
      .filter(({ field }) => field.kept && field.quote)
      .map(({ field }) => field.quote as string)
  }, [fields])

  // Collect dropped quotes
  const droppedQuotes = useMemo(() => {
    return fields
      .filter(({ field }) => !field.kept && field.quote)
      .map(({ field }) => field.quote as string)
  }, [fields])

  const isMockExtractor = trace.geminiChoice.startsWith('Mock extractor')

  return (
    <div
      className={clsx(
        'rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs text-left',
        className,
      )}
    >
      {/* 5. Collapsible Drawer Header: "How U2U checked this" */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="trace-content"
        className="w-full min-h-[52px] px-4 sm:px-5 py-3.5 bg-[var(--border)]/15 hover:bg-[var(--border)]/30 flex items-center justify-between text-sm sm:text-base font-heading font-bold text-[var(--text)] transition-colors cursor-pointer select-none focus-visible:outline-3 focus-visible:outline-[var(--info)]"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <Bot className="w-5 h-5 text-[var(--primary)] shrink-0" aria-hidden="true" />
          <span>How U2U checked this</span>
          <span className="text-xs font-mono font-normal text-[var(--muted)] px-2.5 py-0.5 rounded-full bg-[var(--border)]/40 border border-[var(--border)]/60">
            {trace.codeDecision.split(':')[0]}
          </span>
          {isMockExtractor && (
            <span className="px-2 py-0.5 rounded-md bg-[var(--warning-tint)] text-[var(--warning)] border border-[var(--warning)]/30 text-[10px] font-mono font-bold uppercase tracking-wider">
              Mock
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[var(--muted)] shrink-0">
          <span className="text-xs font-medium hidden sm:inline">
            {isOpen ? 'Collapse' : 'Expand'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Drawer Content */}
      {isOpen && (
        <div id="trace-content" className="p-4 sm:p-6 space-y-6 text-sm">
          {/* One-line explainer */}
          <div className="p-3.5 rounded-xl bg-[var(--border)]/20 border border-[var(--border)]/60 text-xs sm:text-sm text-[var(--text)] flex items-center gap-2.5 shadow-2xs">
            <span className="text-base" aria-hidden="true">💡</span>
            <p className="font-medium">
              Gemini reads. Code checks every word. Only the hospital and blood centre decide.
            </p>
          </div>

          {/* Decision Path Callout: Gemini chose vs Code decided */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Gemini Chose */}
            <div className="p-4 rounded-xl border border-[var(--info)]/30 bg-[var(--info-tint)] space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--info)] uppercase tracking-wider font-mono">
                  <Bot className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Gemini Model Extraction</span>
                </div>
                {isMockExtractor && (
                  <span className="px-1.5 py-0.5 rounded bg-[var(--warning-tint)] text-[var(--warning)] border border-[var(--warning)]/40 text-[10px] font-mono font-bold uppercase">
                    Mock
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[var(--text)] font-semibold leading-relaxed break-words">
                <span className="font-bold text-[var(--info)]">Gemini chose: </span>
                {trace.geminiChoice}
              </p>
            </div>

            {/* Code Decided */}
            <div className="p-4 rounded-xl border border-[var(--success)]/30 bg-[var(--success-tint)] space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--success)] uppercase tracking-wider font-mono">
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Deterministic Code Decision</span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text)] font-semibold leading-relaxed break-words">
                <span className="font-bold text-[var(--success)]">Code decided: </span>
                {trace.codeDecision}
              </p>
            </div>
          </div>

          {/* The Pasted Text with Kept Quotes Highlighted */}
          {rawText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] font-mono">
                  Forwarded Message with Verified Quotes
                </h4>
                <span className="text-[11px] text-[var(--muted)]">
                  Kept quotes highlighted in green
                </span>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] font-sans text-xs sm:text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap break-words shadow-2xs">
                {renderHighlightedText(rawText, keptQuotes)}
              </div>
            </div>
          )}

          {/* Dropped Quotes Banner (if any) */}
          {droppedQuotes.length > 0 && (
            <div className="p-3.5 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-tint)]/60 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[var(--danger)]">
                <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="uppercase tracking-wider font-mono">
                  Dropped Hallucinated / Unverified Quotes
                </span>
              </div>
              <div className="space-y-1">
                {droppedQuotes.map((quote, idx) => (
                  <p key={idx} className="text-[var(--danger)] font-medium">
                    <span className="line-through font-mono font-bold">&quot;{quote}&quot;</span>
                    <span className="ml-2 font-normal">— not found in the message</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Quoted Fields Matrix: Value plus Quote */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] font-mono">
              Extracted Fields &amp; Quote Validation Matrix
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fields.map(({ label, field }) => (
                <div
                  key={label}
                  className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs flex flex-col justify-between gap-2 shadow-2xs"
                >
                  <div>
                    <span className="text-[var(--muted)] font-medium text-[11px] block">{label}</span>
                    <span className="font-heading font-bold text-sm text-[var(--text)] block truncate mt-0.5">
                      {field.value !== null && field.value !== undefined ? String(field.value) : '—'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[var(--border)]/60">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] uppercase font-mono text-[var(--muted)]">Source Quote:</span>
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

                    {field.quote ? (
                      <div className="mt-1">
                        {field.kept ? (
                          <span className="font-mono text-[11px] inline-block px-1.5 py-0.5 rounded bg-[var(--success-tint)] text-[var(--success)] border border-[var(--success)]/30 break-all font-semibold">
                            &quot;{field.quote}&quot;
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="font-mono text-[11px] inline-block px-1.5 py-0.5 rounded bg-[var(--danger-tint)] text-[var(--danger)] line-through border border-[var(--danger)]/30 break-all">
                              &quot;{field.quote}&quot;
                            </span>
                            <span className="text-[10px] text-[var(--danger)] font-medium block">
                              not found in the message
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[var(--muted)] italic block">
                        No quote extracted
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Phrases Detection */}
          {trace.paymentPhrases && trace.paymentPhrases.length > 0 && (
            <div className="p-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-tint)] text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-[var(--danger)]">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="text-sm font-heading">Remuneration / Payment Language Detected</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {trace.paymentPhrases.map((phrase, idx) => (
                  <span
                    key={idx}
                    className="font-mono px-2 py-0.5 rounded bg-[var(--danger)] text-white font-semibold text-xs"
                  >
                    &quot;{phrase}&quot;
                  </span>
                ))}
              </div>
              <p className="text-[var(--danger)] font-medium text-xs leading-relaxed">
                Requests offering payment or conveyance fees are strictly denied outreach per Indian National Blood Transfusion Council regulations.
              </p>
            </div>
          )}

          {/* Mandatory Safety Guardrail Note */}
          <div className="text-[11px] text-[var(--muted)] border-t border-[var(--border)] pt-3 italic">
            Gemini Flash extracts and quotes fields, but deterministic code validates every quote verbatim. Gemini never decides request status, match validity, or donor eligibility.
          </div>
        </div>
      )}
    </div>
  )
}

export default TracePanel
