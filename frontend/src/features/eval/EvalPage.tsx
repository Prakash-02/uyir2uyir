import { useState, useEffect } from 'react'
import { getApi } from '../../api/client'
import type { EvalResult } from '../../api/types'
import { useT } from '../../i18n/useT'
import { CheckCircle2, XCircle, ShieldAlert, Cpu, Timer, Check } from 'lucide-react'
import clsx from 'clsx'

export function EvalPage() {
  const { t } = useT()
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const api = getApi()
    api.getLatestEval()
      .then((res) => {
        if (mounted) setEvalResult(res)
      })
      .catch((err) => {
        console.error('Failed to load eval results:', err)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Header and Sample Run Badge (Step 3 Requirement) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--demo)]/20 text-[#B45309] border border-[var(--demo)]/40 mb-3">
            <span className="w-2 h-2 rounded-full bg-[var(--demo)]" aria-hidden="true" />
            <span>{t.eval.sampleBadge}</span>
          </div>
          <h1
            aria-label="AI Verification Benchmarks — Verification Evaluation Suite"
            className="font-heading font-extrabold text-2xl sm:text-3xl text-[var(--text)] tracking-tight"
          >
            {t.eval.title}
          </h1>
          <p className="text-sm sm:text-base text-[var(--muted)] mt-1 max-w-3xl">
            {t.eval.subtitle}
          </p>
        </div>

        {evalResult && (
          <div className="text-xs text-[var(--muted)] text-left sm:text-right space-y-1 shrink-0 font-mono">
            <div>{t.eval.promptVersion.replace('{version}', evalResult.promptVersion)}</div>
            <div>
              {t.eval.lastRunAt.replace(
                '{date}',
                new Date(evalResult.runAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--muted)] text-sm animate-pulse">
          Loading AI verification benchmarks…
        </div>
      ) : evalResult ? (
        <div className="space-y-8" role="region" aria-label="Evaluation Summary Metrics">
          {/* Summary Tiles: total, correct, paymentToHospital, wrongHospitalIds, p95Latency */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* 1. Total tests */}
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-xs font-heading font-semibold uppercase tracking-wider text-[var(--muted)] block">
                {t.eval.totalTests}
              </span>
              <div className="font-heading font-bold text-3xl sm:text-4xl text-[var(--text)] tnum mt-2">
                {evalResult.total}
              </div>
              <div className="text-xs text-[var(--muted)] mt-2">Labelled test samples</div>
            </div>

            {/* 2. Correct / Accuracy */}
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-xs font-heading font-semibold uppercase tracking-wider text-[var(--muted)] block">
                {t.eval.accuracy}
              </span>
              <div className="font-heading font-bold text-3xl sm:text-4xl text-[var(--success)] tnum mt-2 flex items-baseline gap-1">
                <span>{Math.round((evalResult.correct / evalResult.total) * 100)}%</span>
                <span className="text-xs text-[var(--muted)] font-normal">
                  ({evalResult.correct}/{evalResult.total})
                </span>
              </div>
              <div className="text-xs text-[var(--success)] font-medium mt-2 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Deterministic check</span>
              </div>
            </div>

            {/* 3. Payment to hospital: Target 0 */}
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-xs font-heading font-semibold uppercase tracking-wider text-[var(--muted)] block">
                {t.eval.paymentToHospital}
              </span>
              <div className="font-heading font-bold text-3xl sm:text-4xl text-[var(--success)] tnum mt-2">
                {evalResult.paymentToHospital}
              </div>
              <div className="text-xs text-[var(--success)] font-bold mt-2 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.eval.paymentTarget} (Mandatory)</span>
              </div>
            </div>

            {/* 4. Wrong hospital IDs: Target 0 */}
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-xs font-heading font-semibold uppercase tracking-wider text-[var(--muted)] block">
                {t.eval.wrongHospitalIds}
              </span>
              <div className="font-heading font-bold text-3xl sm:text-4xl text-[var(--success)] tnum mt-2">
                {evalResult.wrongHospitalIds}
              </div>
              <div className="text-xs text-[var(--success)] font-bold mt-2 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.eval.wrongHospitalTarget} (Strict catalog)</span>
              </div>
            </div>

            {/* 5. p95 Latency */}
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs col-span-2 md:col-span-1">
              <span className="text-xs font-heading font-semibold uppercase tracking-wider text-[var(--muted)] block">
                {t.eval.p95Latency}
              </span>
              <div className="font-heading font-bold text-3xl sm:text-4xl text-[var(--text)] tnum mt-2">
                {evalResult.p95LatencyMs}
                <span className="text-lg font-normal text-[var(--muted)]">ms</span>
              </div>
              <div className="text-xs text-[var(--muted)] mt-2 flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 text-[var(--muted)]" aria-hidden="true" />
                <span>Gemini Flash</span>
              </div>
            </div>
          </div>

          {/* Clinical Guardrails Policy Note */}
          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)] space-y-2">
            <div className="font-semibold text-[var(--text)] flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
              <span>Guardrail Guarantees: Why Targets are Zero</span>
            </div>
            <p className="leading-relaxed">
              Under National Blood Transfusion Council (NBTC) regulations, blood donation in India is
              strictly voluntary and unpaid. Messages mentioning financial incentives are permanently
              blocked from hospital routing. Furthermore, Gemini never invents hospital catalog IDs;
              Python code validates exact quotes against registered hospital aliases, ensuring
              <strong> 0 hallucinated dispatch routes</strong>.
            </p>
          </div>

          {/* Evaluation Table */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-heading font-bold text-base text-[var(--text)]">
                {t.eval.tableTitle}
              </h2>
              <span className="text-xs text-[var(--muted)]">
                {evalResult.rows.length} sample cases evaluated
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[var(--surface-muted)] text-[var(--muted)] uppercase font-semibold text-[11px] tracking-wider border-b border-[var(--border)]">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      {t.eval.colId}
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      {t.eval.colExpected}
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      {t.eval.colGot}
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold text-right">
                      {t.eval.colStatus}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono text-xs">
                  {evalResult.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[var(--surface-muted)]/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-semibold text-[var(--text)]">{row.id}</td>
                      <td className="px-5 py-3.5 font-sans">
                        <span
                          className={clsx(
                            'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold',
                            row.expected === 'VERIFIED_MATCH' &&
                              'bg-[var(--success)]/15 text-[var(--success)]',
                            row.expected === 'SENT_TO_HOSPITAL' &&
                              'bg-[var(--warning)]/15 text-[var(--warning)]',
                            row.expected === 'NOT_VERIFIED' &&
                              'bg-[var(--danger)]/15 text-[var(--danger)]',
                          )}
                        >
                          {row.expected}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-sans">
                        <span
                          className={clsx(
                            'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold',
                            row.got === 'VERIFIED_MATCH' &&
                              'bg-[var(--success)]/15 text-[var(--success)]',
                            row.got === 'SENT_TO_HOSPITAL' &&
                              'bg-[var(--warning)]/15 text-[var(--warning)]',
                            row.got === 'NOT_VERIFIED' &&
                              'bg-[var(--danger)]/15 text-[var(--danger)]',
                          )}
                        >
                          {row.got}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-sans">
                        {row.pass ? (
                          <span className="inline-flex items-center gap-1 text-[var(--success)] font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>{t.eval.passBadge}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[var(--danger)] font-bold text-xs">
                            <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>{t.eval.failBadge}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default EvalPage
