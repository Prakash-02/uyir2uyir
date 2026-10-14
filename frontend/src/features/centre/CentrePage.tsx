import { useState, useEffect, useId } from 'react'
import { getApi } from '../../api/client'
import type { BloodRequest, Call, TimelineEvent } from '../../api/types'
import { MOCK_CENTRES } from '../../api/mock/fixtures'
import { StatusBadge } from '../../components/StatusBadge'
import { ProgressBanner } from '../../components/ProgressBanner'
import { CallRow } from '../../components/CallRow'
import { Timeline } from '../../components/Timeline'
import { Button } from '../../components/Button'
import { useT } from '../../i18n/useT'
import * as Switch from '@radix-ui/react-switch'
import * as Tabs from '@radix-ui/react-tabs'
import * as Dialog from '@radix-ui/react-dialog'
import {
  CloudRain,
  PauseCircle,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  ShieldCheck,
  Radio,
  Layers,
} from 'lucide-react'
import clsx from 'clsx'

const DEMO_CENTRE = MOCK_CENTRES[0] // Central Blood Bank, Egmore (Simulated)

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024
    }
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateSize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  return isDesktop
}

export function CentrePage() {
  const { t, lang } = useT()
  const api = getApi()
  const returnDateInputId = useId()
  const isDesktop = useIsDesktop()

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'calls' | 'timeline'>('calls')

  // Weather alert state
  const [weatherAlert, setWeatherAlert] = useState(false)
  const [isWeatherUpdating, setIsWeatherUpdating] = useState(false)

  // Requests state
  const [centreRequests, setCentreRequests] = useState<BloodRequest[]>([])
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<BloodRequest | null>(null)

  // Calls and events for selected request
  const [calls, setCalls] = useState<Call[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])

  // Action states
  const [actionPendingCallId, setActionPendingCallId] = useState<string | null>(null)
  const [callToDefer, setCallToDefer] = useState<Call | null>(null)
  const [returnDate, setReturnDate] = useState('')
  const [isDeferring, setIsDeferring] = useState(false)

  // 1. Initial configuration & weather status
  useEffect(() => {
    let mounted = true
    api.getConfig()
      .then((cfg) => {
        if (mounted) {
          setWeatherAlert(Boolean(cfg.weatherAlert))
        }
      })
      .catch((err) => {
        console.error('Failed to load initial app config:', err)
      })
    return () => {
      mounted = false
    }
  }, [api])

  // 2. Weather alert toggle handler
  const handleWeatherAlertToggle = async (checked: boolean) => {
    if (isWeatherUpdating) return
    setIsWeatherUpdating(true)
    try {
      const updated = await api.setWeatherAlert(checked)
      setWeatherAlert(updated.weatherAlert)
    } catch (err) {
      console.error('Failed to update weather alert:', err)
    } finally {
      setIsWeatherUpdating(false)
    }
  }

  // 3. Subscribe to active blood requests for this blood centre
  useEffect(() => {
    const unsub = api.subscribeRequests({ centreId: DEMO_CENTRE.id }, (requests) => {
      const sorted = [...requests].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      setCentreRequests(sorted)

      setActiveRequestId((prevId) => {
        // If previous selection still exists in the updated list, keep it
        if (prevId && sorted.some((r) => r.id === prevId)) {
          return prevId
        }
        // Otherwise prefer OPEN or PAUSED request, or latest
        if (sorted.length > 0) {
          const inProgress = sorted.find((r) => r.status === 'OPEN' || r.status === 'PAUSED')
          return (inProgress ?? sorted[0]).id
        }
        return null
      })
    })

    return () => unsub()
  }, [api])

  // 4. Subscribe to the active request's details, calls, and timeline events
  useEffect(() => {
    if (!activeRequestId) return

    const unsubReq = api.subscribeRequest(activeRequestId, (req) => {
      setSelectedRequest(req)
    })

    const unsubCalls = api.subscribeCalls(activeRequestId, (newCalls) => {
      setCalls(newCalls)
    })

    const unsubEvents = api.subscribeEvents(activeRequestId, (newEvents) => {
      setEvents(newEvents)
    })

    return () => {
      unsubReq()
      unsubCalls()
      unsubEvents()
    }
  }, [api, activeRequestId])

  // 5. Donor Acceptance Handler
  const handleAcceptDonor = async (callId: string) => {
    if (actionPendingCallId) return
    setActionPendingCallId(callId)
    try {
      await api.acceptCall(callId)
    } catch (err) {
      console.error('Failed to accept donor call:', err)
    } finally {
      setActionPendingCallId(null)
    }
  }

  // 6. Deferral Modal Handlers
  const handleOpenDeferDialog = (call: Call) => {
    setCallToDefer(call)
    setReturnDate('')
  }

  const handleCloseDeferDialog = (open: boolean) => {
    if (!open) {
      setCallToDefer(null)
      setReturnDate('')
    }
  }

  const handleConfirmDefer = async () => {
    if (!callToDefer || isDeferring) return
    setIsDeferring(true)
    try {
      await api.deferCall(callToDefer.id, returnDate.trim() || undefined)
      setCallToDefer(null)
      setReturnDate('')
    } catch (err) {
      console.error('Failed to defer donor call:', err)
    } finally {
      setIsDeferring(false)
    }
  }

  // Compute coverage numbers
  const covered = selectedRequest ? selectedRequest.accepted + selectedRequest.onTheWay : 0
  const nTarget = selectedRequest ? selectedRequest.unitsNeeded : 0
  const nPlusOne = nTarget + 1

  const progressLabel = selectedRequest
    ? selectedRequest.status === 'FULFILLED'
      ? `${selectedRequest.accepted} of ${nTarget} units accepted (target N) — Request Fulfilled`
      : `${covered} of ${nPlusOne} covered (target N+1) · ${selectedRequest.accepted} of ${nTarget} accepted (target N)`
    : undefined

  // Content for the Selected Request triage view (shared between mobile tab & desktop column)
  const renderTriageContent = () => {
    if (!selectedRequest) {
      return (
        <div className="p-8 text-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-sm">
          {t.centre.noRequests}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Header bar for selected request */}
        <div className="p-4 sm:p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)]/60 pb-3">
            <div className="flex items-center gap-3">
              <span className="font-heading font-bold text-2xl text-[var(--primary)]">
                {selectedRequest.bloodGroup}
              </span>
              <div>
                <h3 className="font-heading font-bold text-base text-[var(--text)]">
                  {selectedRequest.component.replace(/_/g, ' ')}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {selectedRequest.hospitalName}
                  {selectedRequest.patientRef ? ` · Ref: ${selectedRequest.patientRef}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <span
                aria-live="polite"
                className="font-heading font-bold text-xs sm:text-sm px-2.5 py-1 rounded-md bg-[var(--info-tint)] text-[var(--info)] border border-[var(--info)]/20"
              >
                Round {selectedRequest.round}
              </span>
              <StatusBadge status={selectedRequest.status} />
            </div>
          </div>

          {/* Progress Banner with covered vs N+1 and accepted vs N */}
          <ProgressBanner
            unitsNeeded={selectedRequest.unitsNeeded}
            accepted={selectedRequest.accepted}
            onTheWay={selectedRequest.onTheWay}
            label={progressLabel}
          />

          {/* Meta metrics strip */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-[var(--muted)] pt-1">
            <span aria-live="polite">
              Covered: <strong className="text-[var(--text)] tnum">{covered}</strong> / {nPlusOne} (N+1)
            </span>
            <span>·</span>
            <span aria-live="polite">
              Accepted: <strong className="text-[var(--text)] tnum">{selectedRequest.accepted}</strong> / {nTarget} (N)
            </span>
            <span>·</span>
            <span aria-live="polite">
              Target (N): <strong className="text-[var(--text)] tnum">{selectedRequest.unitsNeeded}</strong> units
            </span>
          </div>

          {/* Warning note when PAUSED */}
          {selectedRequest.status === 'PAUSED' && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 p-4 rounded-xl bg-[var(--warning-tint)] border border-[var(--warning)]/30 text-[var(--warning)] shadow-xs animate-fade-in"
            >
              <PauseCircle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--warning)]" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="font-bold text-sm text-[var(--text)]">
                  Enough donors on the way. Calling paused. U2U will call again if someone drops out.
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Outreach stands on hold at N+1 coverage ({covered} donors). If a donor declines or cancels, outreach reopens automatically.
                </p>
              </div>
            </div>
          )}

          {/* Success note when FULFILLED */}
          {selectedRequest.status === 'FULFILLED' && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 p-4 rounded-xl bg-[var(--success-tint)] border border-[var(--success)]/30 text-[var(--success)] shadow-xs animate-fade-in"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[var(--success)]" aria-hidden="true" />
              <div>
                <p className="font-bold text-sm text-[var(--text)]">
                  Target of {selectedRequest.unitsNeeded} units clinically accepted. Request Fulfilled.
                </p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  All target donations have been received and verified by centre staff. Standing down active callers.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CallRows section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-base text-[var(--text)]">
                {t.centre.callsLabel}
              </h3>
              <span
                aria-live="polite"
                className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--border)]/40 text-[var(--muted)]"
              >
                {calls.length} calls
              </span>
            </div>
            <span className="text-xs text-[var(--muted)] font-mono">
              Round {selectedRequest.round} active
            </span>
          </div>

          {calls.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-sm">
              {t.centre.noCalls}
            </div>
          ) : (
            <div className="space-y-2.5">
              {calls.map((call) => {
                const isOnTheWay = call.state === 'ON_THE_WAY'
                return (
                  <CallRow
                    key={call.id}
                    donorAlias={call.donorAlias}
                    bloodGroup={call.bloodGroup}
                    state={call.state}
                    distanceKm={call.distanceKm}
                    etaMinutes={call.etaMinutes}
                    round={call.round}
                    action={
                      isOnTheWay ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="primary"
                            onClick={() => handleAcceptDonor(call.id)}
                            isLoading={actionPendingCallId === call.id}
                            className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold"
                            aria-label={`Accept donation from ${call.donorAlias}`}
                          >
                            {t.centre.acceptButton}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleOpenDeferDialog(call)}
                            disabled={actionPendingCallId === call.id}
                            className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold"
                            aria-label={`Defer ${call.donorAlias}`}
                          >
                            {t.centre.deferButton}
                          </Button>
                        </div>
                      ) : undefined
                    }
                  />
                )
              })}
            </div>
          )}

          {/* Mandatory Clinical Screening Note Under Actions */}
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)] shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
            <span className="font-medium text-[var(--text)]">
              Accept only after your own screening. U2U never decides eligibility.
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              {t.centre.badge}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {t.centre.roleNote}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text)] mt-1 tracking-tight">
            Sample Blood Centre (demo)
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            {t.centre.subtitle}
          </p>
        </div>

        {/* Weather Alert Switch (Radix) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
            <div className="flex items-center gap-2">
              <CloudRain
                className={clsx(
                  'w-5 h-5 shrink-0 transition-colors',
                  weatherAlert ? 'text-[var(--warning)]' : 'text-[var(--muted)]',
                )}
                aria-hidden="true"
              />
              <label
                htmlFor="imd-weather-alert-switch"
                className="text-xs sm:text-sm font-semibold text-[var(--text)] cursor-pointer select-none"
              >
                {lang === 'ta' ? t.centre.weatherAlertLabel : 'IMD orange alert (rain)'}
              </label>
            </div>
            <Switch.Root
              id="imd-weather-alert-switch"
              checked={weatherAlert}
              onCheckedChange={handleWeatherAlertToggle}
              disabled={isWeatherUpdating}
              aria-label="Toggle IMD orange alert (rain) safety note in donor dispatch calls"
              className="w-11 h-6 bg-[var(--border)] rounded-full relative data-[state=checked]:bg-[var(--warning)] transition-colors cursor-pointer outline-none focus-visible:outline-3 focus-visible:outline-[var(--info)] focus-visible:outline-offset-2 shrink-0 ml-1"
            >
              <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
          </div>
        </div>
      </header>

      {/* Weather Alert Info Note when Switch is ON */}
      {weatherAlert && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 p-4 rounded-xl bg-[var(--info-tint)] border border-[var(--info)]/20 text-[var(--info)] text-sm shadow-xs animate-fade-in"
        >
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <p className="font-medium text-[var(--text)] leading-snug">
            Calls now include: If roads near you are unsafe because of rain, please press 2.
          </p>
        </div>
      )}

      {/* 2. Active Requests Selector List */}
      <section className="space-y-3" aria-labelledby="active-requests-heading">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
            <h2 id="active-requests-heading" className="font-heading font-bold text-lg text-[var(--text)]">
              {t.centre.activeRequestsTitle}
            </h2>
            <span
              aria-live="polite"
              className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--border)]/40 text-[var(--muted)]"
            >
              {centreRequests.length} active
            </span>
          </div>
          <span className="text-xs text-[var(--muted)]">
            Click a request to monitor its outreach and screen arriving donors
          </span>
        </div>

        {centreRequests.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-sm">
            {t.centre.noRequests}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {centreRequests.map((req) => {
              const isSelected = req.id === activeRequestId
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setActiveRequestId(req.id)}
                  aria-pressed={isSelected}
                  aria-label={`Select ${req.bloodGroup} ${req.component} request for ${req.hospitalName}`}
                  className={clsx(
                    'p-4 rounded-xl border text-left flex flex-col justify-between gap-3 shadow-2xs transition-all cursor-pointer focus-visible:outline-3 focus-visible:outline-[var(--info)]',
                    isSelected
                      ? 'border-[var(--primary)] bg-[var(--surface)] ring-2 ring-[var(--primary)]/20 shadow-xs'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border)]/80 hover:bg-[var(--border)]/10',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-xl text-[var(--primary)]">
                          {req.bloodGroup}
                        </span>
                        <span className="text-sm font-semibold text-[var(--text)]">
                          {req.component.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1 truncate max-w-[200px]">
                        {req.hospitalName}
                      </div>
                    </div>
                    <StatusBadge status={req.status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]/60 w-full">
                    <span>
                      Target: <strong className="text-[var(--text)]">{req.unitsNeeded} units</strong>
                    </span>
                    <span aria-live="polite">
                      {req.accepted} accepted · {req.onTheWay} on the way
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* 3 & 4. Selected Request View & Timeline (Adaptive Mobile Tabs vs Desktop Split) */}
      <section aria-label="Request Workspace">
        {isDesktop ? (
          /* Desktop View: 2-Column Split (>= 1024px) */
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): Donor triage & selected request details */}
            <div className="col-span-7 space-y-4">
              {renderTriageContent()}
            </div>

            {/* Right Column (5 cols): Live timeline */}
            <div className="col-span-5 space-y-3 sticky top-20">
              <div className="flex items-center justify-between p-1">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[var(--info)] shrink-0" aria-hidden="true" />
                  <h3 className="font-heading font-bold text-lg text-[var(--text)]">
                    {t.centre.timelineTitle}
                  </h3>
                </div>
                <span
                  aria-live="polite"
                  className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--border)]/40 text-[var(--muted)]"
                >
                  {events.length} events
                </span>
              </div>
              <Timeline events={events} maxItems={25} />
            </div>
          </div>
        ) : (
          /* Mobile View: Radix Tabs (< 1024px) */
          <div className="w-full">
            <Tabs.Root
              value={mobileTab}
              onValueChange={(val) => setMobileTab(val as 'calls' | 'timeline')}
              className="w-full"
            >
              <Tabs.List
                className="flex border-b border-[var(--border)] mb-4 gap-2"
                aria-label="Blood Centre View Tabs"
              >
                <Tabs.Trigger
                  value="calls"
                  className="flex-1 py-3 px-4 text-sm font-heading font-bold text-[var(--muted)] border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] transition-colors cursor-pointer select-none"
                >
                  {t.centre.tabCalls} ({calls.length})
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="timeline"
                  className="flex-1 py-3 px-4 text-sm font-heading font-bold text-[var(--muted)] border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] transition-colors cursor-pointer select-none"
                >
                  {t.centre.tabTimeline} ({events.length})
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="calls" className="space-y-4 focus:outline-none">
                {renderTriageContent()}
              </Tabs.Content>

              <Tabs.Content value="timeline" className="space-y-3 focus:outline-none">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[var(--info)] shrink-0" aria-hidden="true" />
                    <h3 className="font-heading font-bold text-base text-[var(--text)]">
                      {t.centre.timelineTitle}
                    </h3>
                  </div>
                  <span
                    aria-live="polite"
                    className="text-xs font-mono px-2 py-0.5 rounded-full bg-[var(--border)]/40 text-[var(--muted)]"
                  >
                    {events.length} events
                  </span>
                </div>
                <Timeline events={events} />
              </Tabs.Content>
            </Tabs.Root>
          </div>
        )}
      </section>

      {/* 5. Deferral Modal Dialog (Radix Dialog) */}
      <Dialog.Root open={Boolean(callToDefer)} onOpenChange={handleCloseDeferDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface)] text-[var(--text)] p-6 rounded-2xl border border-[var(--border)] shadow-xl z-50 w-[92vw] max-w-md focus:outline-none animate-fade-in">
            <div className="flex items-center gap-3 text-[var(--warning)] mb-2">
              <CalendarClock className="w-6 h-6 shrink-0 text-[var(--warning)]" aria-hidden="true" />
              <Dialog.Title className="font-heading font-bold text-lg text-[var(--text)]">
                {callToDefer ? `${t.centre.deferDialogTitle} ${callToDefer.donorAlias}` : t.centre.deferDialogTitle}
              </Dialog.Title>
            </div>

            <Dialog.Description className="text-sm text-[var(--muted)] leading-relaxed mt-2">
              {t.centre.deferDialogDesc}
            </Dialog.Description>

            <div className="mt-4 space-y-2">
              <label
                htmlFor={returnDateInputId}
                className="block text-sm font-semibold text-[var(--text)]"
              >
                {t.centre.deferReturnDateLabel}
              </label>
              <input
                id={returnDateInputId}
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-3 focus:outline-[var(--info)] transition-colors min-h-[44px]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="secondary" type="button">
                  {t.centre.deferCancel}
                </Button>
              </Dialog.Close>
              <Button
                variant="primary"
                type="button"
                onClick={handleConfirmDefer}
                isLoading={isDeferring}
                className="bg-[var(--warning)] hover:brightness-110 text-white"
              >
                {t.centre.deferConfirm}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

export default CentrePage
