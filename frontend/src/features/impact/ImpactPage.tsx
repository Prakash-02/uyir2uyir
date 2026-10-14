import { useState, useEffect } from 'react'
import { getApi } from '../../api/client'
import type { Metrics } from '../../api/types'
import { StatTile } from '../../components/StatTile'
import { useT } from '../../i18n/useT'
import { Activity, PhoneCall, ShieldCheck, Clock, Play } from 'lucide-react'

export function ImpactPage() {
  const { t } = useT()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getApi()
      .getMetrics()
      .then((data) => {
        if (mounted) {
          setMetrics(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load metrics:', err)
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const calcFasterPct = (actual: number, baseline: number): number => {
    if (actual <= 0 || baseline <= 0) return 0
    return Math.max(0, Math.round(((baseline - actual) / baseline) * 100))
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Top Banner Label: Step 2 Requirement */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--demo)]/20 text-[#B45309] border border-[var(--demo)]/40 mb-3">
            <span className="w-2 h-2 rounded-full bg-[var(--demo)]" aria-hidden="true" />
            <span>Simulated data from demo runs</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[var(--text)] tracking-tight">
            {t.impact.title}
          </h1>
          <p className="text-sm sm:text-base text-[var(--muted)] mt-1 max-w-3xl">
            {t.impact.subtitle}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--muted)] text-sm animate-pulse">
          Loading impact metrics…
        </div>
      ) : metrics ? (
        <div className="space-y-8" role="region" aria-label="Coordination Impact Metrics">
          {/* If no completed run exists yet, show prompt to Run the story */}
          {metrics.medianMinutesToFirstOnTheWay === 0 && (
            <div className="p-5 rounded-xl border border-[var(--demo)]/40 bg-[var(--demo)]/10 text-[var(--text)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[var(--demo)] shrink-0" aria-hidden="true" />
                <p className="text-sm">{t.impact.emptyNotice}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const api = getApi()
                  await api.runScenario('story')
                  const data = await api.getMetrics()
                  setMetrics(data)
                }}
                className="px-4 py-2 bg-[#1C1917] text-white hover:bg-[#3A332F] rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shrink-0 inline-flex items-center gap-1.5 cursor-pointer shadow-xs focus-visible:outline-3 focus-visible:outline-white"
              >
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>{t.impact.runStoryAction}</span>
              </button>
            </div>
          )}

          {/* 3 Core Impact StatTiles with Comparison Baselines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Time to first donor on the way */}
            <StatTile
              label={t.impact.timeToFirstOnTheWay}
              value={
                metrics.medianMinutesToFirstOnTheWay > 0
                  ? `${metrics.medianMinutesToFirstOnTheWay}m`
                  : '—'
              }
              baseline={
                metrics.medianMinutesToFirstOnTheWay > 0
                  ? `Baseline: ${metrics.baseline.toFirstOnTheWay}m (${calcFasterPct(
                      metrics.medianMinutesToFirstOnTheWay,
                      metrics.baseline.toFirstOnTheWay,
                    )}% faster)`
                  : `Baseline: ${metrics.baseline.toFirstOnTheWay}m (broadcast)`
              }
              trend="positive"
            />

            {/* 2. Time to covered */}
            <StatTile
              label={t.impact.timeToCovered}
              value={
                metrics.medianMinutesToCovered > 0
                  ? `${metrics.medianMinutesToCovered}m`
                  : '—'
              }
              baseline={
                metrics.medianMinutesToCovered > 0
                  ? `Baseline: ${metrics.baseline.toCovered}m (${calcFasterPct(
                      metrics.medianMinutesToCovered,
                      metrics.baseline.toCovered,
                    )}% faster)`
                  : `Baseline: ${metrics.baseline.toCovered}m (broadcast)`
              }
              trend="positive"
            />

            {/* 3. Time to fulfilled */}
            <StatTile
              label={t.impact.timeToFulfilled}
              value={
                metrics.medianMinutesToFulfilled > 0
                  ? `${metrics.medianMinutesToFulfilled}m`
                  : '—'
              }
              baseline={
                metrics.medianMinutesToFulfilled > 0
                  ? `Baseline: ${metrics.baseline.toFulfilled}m (${calcFasterPct(
                      metrics.medianMinutesToFulfilled,
                      metrics.baseline.toFulfilled,
                    )}% faster)`
                  : `Baseline: ${metrics.baseline.toFulfilled}m (broadcast)`
              }
              trend="positive"
            />
          </div>

          {/* Secondary Operational Metrics: Calls per accepted and Stand-down reach */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Calls per accepted donor */}
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-heading font-semibold text-xs text-[var(--muted)] tracking-wide uppercase">
                    {t.impact.callsPerAcceptedTitle}
                  </span>
                  <PhoneCall className="w-4 h-4 text-[var(--muted)]" aria-hidden="true" />
                </div>
                <div className="font-heading font-bold text-3xl sm:text-[40px] sm:leading-[1.1] text-[var(--primary)] tnum mt-2">
                  {metrics.callsPerAccepted > 0 ? metrics.callsPerAccepted : '—'}
                </div>
                <p className="text-xs sm:text-sm text-[var(--muted)] mt-2 leading-relaxed">
                  {t.impact.callsPerAcceptedDesc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border)]/60 text-xs text-[var(--muted)] flex items-center justify-between">
                <span>Comparison:</span>
                <span className="text-[var(--success)] font-medium">
                  vs ~30+ uncoordinated calls in broadcast
                </span>
              </div>
            </div>

            {/* Stand-down reach */}
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-heading font-semibold text-xs text-[var(--muted)] tracking-wide uppercase">
                    {t.impact.standDownReachTitle}
                  </span>
                  <ShieldCheck className="w-4 h-4 text-[var(--success)]" aria-hidden="true" />
                </div>
                <div className="font-heading font-bold text-3xl sm:text-[40px] sm:leading-[1.1] text-[var(--primary)] tnum mt-2">
                  {metrics.standDownReachPct > 0 ? `${metrics.standDownReachPct}%` : '—'}
                </div>
                <p className="text-xs sm:text-sm text-[var(--muted)] mt-2 leading-relaxed">
                  {t.impact.standDownReachDesc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border)]/60 text-xs text-[var(--muted)] flex items-center justify-between">
                <span>Comparison:</span>
                <span className="text-[var(--success)] font-medium">
                  Zero unnotified donor arrivals
                </span>
              </div>
            </div>
          </div>

          {/* Clinical & Assumption Explainer Card */}
          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)] space-y-2">
            <div className="font-semibold text-[var(--text)] flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
              <span>Baseline Assumption Methodology</span>
            </div>
            <p className="leading-relaxed">
              The status quo baseline simulates uncoordinated broadcast outreach (e.g. broadcast
              WhatsApp messages and public phone trees). Based on transfusion service benchmarks,
              broadcasts require an average of 45 minutes for the first donor to read and commit, 90
              minutes to cover the need without reserve guarantees, and 180 minutes to fulfill the
              request. U2U uses deterministic 5-donor rounds with the $N+1$ rule to eliminate donor
              fatigue.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ImpactPage
