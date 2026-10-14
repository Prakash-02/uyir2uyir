import { useState, useEffect } from 'react'
import { getApi } from '../../api/client'
import type { BloodRequest, BloodGroup, Component, TimelineEvent } from '../../api/types'
import { MOCK_HOSPITALS } from '../../api/mock/fixtures'
import { Field, Input, Select } from '../../components/Field'
import { Button } from '../../components/Button'
import { StatusBadge } from '../../components/StatusBadge'
import { ProgressBanner } from '../../components/ProgressBanner'
import { Timeline } from '../../components/Timeline'
import { Card, CardHeader } from '../../components/Card'
import { useT } from '../../i18n/useT'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Building2,
  Share2,
  CheckCircle2,
  PlusCircle,
  Clock,
  AlertCircle,
  Droplet,
  ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'

const DEMO_HOSPITAL = MOCK_HOSPITALS[0] // Sample General Hospital, Chennai

const BLOOD_GROUPS: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

const COMPONENTS: { value: Component; labelKey: keyof typeof import('../../i18n/en').en.hospital.components }[] = [
  { value: 'RED_CELLS', labelKey: 'RED_CELLS' },
  { value: 'PLATELETS_SDP', labelKey: 'PLATELETS_SDP' },
  { value: 'PLATELETS_RDP', labelKey: 'PLATELETS_RDP' },
  { value: 'WHOLE_BLOOD', labelKey: 'WHOLE_BLOOD' },
  { value: 'PLASMA', labelKey: 'PLASMA' },
]

export function HospitalPage() {
  const { t } = useT()
  const api = getApi()

  // Form state
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('O+')
  const [component, setComponent] = useState<Component | ''>('RED_CELLS')
  const [unitsNeeded, setUnitsNeeded] = useState<number>(2)
  const [patientRef, setPatientRef] = useState<string>('')
  const [formErrors, setFormErrors] = useState<{
    bloodGroup?: string
    component?: string
    unitsNeeded?: string
    patientRef?: string
  }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Active request & live lists
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [activeRequest, setActiveRequest] = useState<BloodRequest | null>(null)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [hospitalRequests, setHospitalRequests] = useState<BloodRequest[]>([])

  // Cancel dialog
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // 1. Subscribe to all requests for this hospital
  useEffect(() => {
    const unsub = api.subscribeRequests(
      { hospitalId: DEMO_HOSPITAL.id },
      (requests) => {
        const sorted = [...requests].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        setHospitalRequests(sorted)

        // If no active request is selected, pick the latest open/paused request, or the newest request
        if (!activeRequestId && sorted.length > 0) {
          const inProgress = sorted.find((r) => r.status === 'OPEN' || r.status === 'PAUSED')
          setActiveRequestId((inProgress ?? sorted[0]).id)
        }
      },
    )
    return () => unsub()
  }, [api, activeRequestId])

  // 2. Subscribe to active request live state
  useEffect(() => {
    if (!activeRequestId) return

    const unsubReq = api.subscribeRequest(activeRequestId, (req) => {
      setActiveRequest(req)
    })

    const unsubEvents = api.subscribeEvents(activeRequestId, (evs) => {
      setEvents(evs)
    })

    return () => {
      unsubReq()
      unsubEvents()
    }
  }, [api, activeRequestId])

  // Form validation & submission
  const handleRaiseRequest = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: typeof formErrors = {}
    if (!bloodGroup) {
      errors.bloodGroup = t.hospital.errors.bloodGroupRequired
    }
    if (!component) {
      errors.component = t.hospital.errors.componentRequired
    }
    if (!unitsNeeded || unitsNeeded < 1 || unitsNeeded > 6) {
      errors.unitsNeeded = t.hospital.errors.unitsInvalid
    }
    if (!patientRef.trim()) {
      errors.patientRef = t.hospital.errors.patientRefRequired
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    setIsSubmitting(true)

    try {
      const created = await api.createRequest({
        hospitalId: DEMO_HOSPITAL.id,
        hospitalName: DEMO_HOSPITAL.name,
        bloodGroup: bloodGroup as BloodGroup,
        component: component as Component,
        unitsNeeded,
        patientRef: patientRef.trim(),
      })

      setActiveRequestId(created.id)
      setPatientRef('')
    } catch (err) {
      console.error('Failed to create blood request:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Cancellation handler
  const handleConfirmCancel = async () => {
    if (!activeRequest) return
    setIsCancelling(true)
    try {
      await api.cancelRequest(activeRequest.id)
      setIsCancelDialogOpen(false)
    } catch (err) {
      console.error('Failed to cancel request:', err)
    } finally {
      setIsCancelling(false)
    }
  }

  // Uyir chain WhatsApp trigger
  const handleSendUyirChain = () => {
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://uyir2uyir.web.app'
    const text = `Someone gave life to your family today. When you're ready, you can do the same. Join U2U: ${origin}/join`
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* 1. Demo Role Note */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3.5 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs text-[var(--muted)] block">
              {t.hospital.roleNote}
            </span>
            <span className="font-heading font-bold text-sm text-[var(--text)]">
              {DEMO_HOSPITAL.name} · {DEMO_HOSPITAL.area}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-[var(--info-tint)] text-[var(--info)] text-xs font-bold tracking-wide uppercase">
            Clinical Portal
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 2. Raise Request Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-[var(--border)] bg-[var(--surface)]">
            <CardHeader
              title={t.hospital.formTitle}
              subtitle="Initiate automated outreach to nearby consented donors."
              action={
                <div className="w-8 h-8 rounded-full bg-[var(--danger-tint)] text-[var(--primary)] flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" aria-hidden="true" />
                </div>
              }
            />

            <form onSubmit={handleRaiseRequest} className="space-y-4">
              {/* Blood Group */}
              <Field
                id="bloodGroup"
                label={t.hospital.bloodGroupLabel}
                error={formErrors.bloodGroup}
                required
              >
                <Select
                  id="bloodGroup"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  hasError={Boolean(formErrors.bloodGroup)}
                >
                  <option value="" disabled>
                    {t.hospital.bloodGroupPlaceholder}
                  </option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Component */}
              <Field
                id="component"
                label={t.hospital.componentLabel}
                error={formErrors.component}
                required
              >
                <Select
                  id="component"
                  value={component}
                  onChange={(e) => setComponent(e.target.value as Component)}
                  hasError={Boolean(formErrors.component)}
                >
                  <option value="" disabled>
                    {t.hospital.componentPlaceholder}
                  </option>
                  {COMPONENTS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {t.hospital.components[c.labelKey]}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Units */}
              <Field
                id="unitsNeeded"
                label={t.hospital.unitsLabel}
                error={formErrors.unitsNeeded}
                required
              >
                <Select
                  id="unitsNeeded"
                  value={unitsNeeded}
                  onChange={(e) => setUnitsNeeded(Number(e.target.value))}
                  hasError={Boolean(formErrors.unitsNeeded)}
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'unit' : 'units'}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Patient Reference */}
              <Field
                id="patientRef"
                label={t.hospital.patientRefLabel}
                hint={t.hospital.patientRefHint}
                error={formErrors.patientRef}
                required
              >
                <Input
                  id="patientRef"
                  type="text"
                  value={patientRef}
                  onChange={(e) => setPatientRef(e.target.value)}
                  placeholder={t.hospital.patientRefPlaceholder}
                  hasError={Boolean(formErrors.patientRef)}
                  maxLength={30}
                />
              </Field>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="w-full"
                >
                  {t.hospital.submitButton}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* 3. Active Request Live Tracker (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {activeRequest ? (
            <div className="space-y-6">
              {/* Request Card */}
              <Card className="border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-[var(--border)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-extrabold text-2xl text-[var(--primary)]">
                        {activeRequest.bloodGroup}
                      </span>
                      <span className="text-base font-bold text-[var(--text)]">
                        {activeRequest.component.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-1">
                      <span>Target: <strong className="text-[var(--text)]">{activeRequest.unitsNeeded} units</strong></span>
                      <span>·</span>
                      <span>Ref: <strong className="text-[var(--text)] font-mono">{activeRequest.patientRef}</strong></span>
                      <span>·</span>
                      <span>Round <strong className="text-[var(--text)]">{activeRequest.round}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={activeRequest.status} />
                    {activeRequest.status !== 'FULFILLED' &&
                      activeRequest.status !== 'CANCELLED' && (
                        <Button
                          variant="ghost"
                          onClick={() => setIsCancelDialogOpen(true)}
                          className="text-xs text-[var(--danger)] hover:bg-[var(--danger-tint)] min-h-[36px] px-3 py-1"
                        >
                          {t.hospital.cancelButton}
                        </Button>
                      )}
                  </div>
                </div>

                {/* Progress Banner */}
                <div className="pt-4">
                  <ProgressBanner
                    unitsNeeded={activeRequest.unitsNeeded}
                    accepted={activeRequest.accepted}
                    onTheWay={activeRequest.onTheWay}
                    label={`${activeRequest.onTheWay} on the way · ${activeRequest.accepted} accepted · need ${activeRequest.unitsNeeded}`}
                  />
                </div>

                {/* 5. Fulfilled Success Card & Uyir Chain Message */}
                {activeRequest.status === 'FULFILLED' && (
                  <div className="mt-5 p-5 rounded-xl border border-[var(--success)] bg-[var(--success-tint)] text-[var(--success)] space-y-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0" aria-hidden="true" />
                      <h4 className="font-heading font-bold text-base text-[var(--success)]">
                        {t.hospital.fulfilledTitle}
                      </h4>
                    </div>
                    <p className="text-xs text-[var(--text)] leading-relaxed">
                      {t.hospital.fulfilledDesc}
                    </p>

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleSendUyirChain}
                        className="bg-[var(--success)] text-white hover:brightness-110 min-h-[44px] text-xs font-bold"
                        leftIcon={<Share2 className="w-4 h-4" aria-hidden="true" />}
                        rightIcon={<ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />}
                      >
                        {t.hospital.sendChainMessage}
                      </Button>
                      <span className="text-[11px] text-[var(--muted)] italic">
                        {t.hospital.chainPrivacyHint}
                      </span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Live Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-base text-[var(--text)]">
                    {t.hospital.liveTimelineTitle}
                  </h3>
                  <span className="text-xs text-[var(--muted)] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Real-time stream</span>
                  </span>
                </div>
                <Timeline events={events} maxItems={6} />
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center space-y-2">
              <Droplet className="w-8 h-8 mx-auto text-[var(--primary)] opacity-40" aria-hidden="true" />
              <h3 className="font-heading font-bold text-base text-[var(--text)]">
                No Active Request Selected
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Fill the form on the left to raise an emergency blood request.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. My Requests List Below */}
      <section aria-labelledby="my-requests-heading" className="space-y-4 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <h2 id="my-requests-heading" className="font-heading font-bold text-xl text-[var(--text)]">
            {t.hospital.myRequestsTitle}
          </h2>
          <span className="text-xs text-[var(--muted)]">
            {hospitalRequests.length} {hospitalRequests.length === 1 ? 'request' : 'requests'} on record
          </span>
        </div>

        {hospitalRequests.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-sm">
            {t.hospital.myRequestsEmpty}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hospitalRequests.map((req) => {
              const isSelected = req.id === activeRequestId
              return (
                <div
                  key={req.id}
                  onClick={() => setActiveRequestId(req.id)}
                  className={clsx(
                    'p-4 rounded-xl border transition-all cursor-pointer bg-[var(--surface)] text-left flex flex-col justify-between gap-3 shadow-2xs',
                    isSelected
                      ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20 shadow-xs'
                      : 'border-[var(--border)] hover:border-[var(--border)]/80 hover:bg-[var(--border)]/10',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-heading font-bold text-lg text-[var(--primary)]">
                          {req.bloodGroup}
                        </span>
                        <span className="text-xs font-semibold text-[var(--text)]">
                          {req.component.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted)] font-mono mt-0.5">
                        Patient Ref: <strong className="text-[var(--text)]">{req.patientRef}</strong>
                      </div>
                    </div>
                    <StatusBadge status={req.status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]/60">
                    <span>Target: <strong>{req.unitsNeeded} units</strong></span>
                    <span>
                      {req.accepted} accepted · {req.onTheWay} en route
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Cancel Confirmation Dialog */}
      <Dialog.Root open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface)] text-[var(--text)] p-6 rounded-2xl border border-[var(--border)] shadow-xl z-50 w-[92vw] max-w-md focus:outline-none">
            <div className="flex items-center gap-3 text-[var(--danger)] mb-2">
              <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
              <Dialog.Title className="font-heading font-bold text-lg text-[var(--text)]">
                {t.hospital.cancelDialogTitle}
              </Dialog.Title>
            </div>
            <Dialog.Description className="text-sm text-[var(--muted)] leading-relaxed mt-2">
              {t.hospital.cancelDialogDesc}
            </Dialog.Description>
            <div className="flex items-center justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="secondary">
                  {t.hospital.cancelKeep}
                </Button>
              </Dialog.Close>
              <Button
                variant="primary"
                onClick={handleConfirmCancel}
                isLoading={isCancelling}
                className="bg-[var(--danger)] hover:brightness-110 text-white"
              >
                {t.hospital.cancelConfirm}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

export default HospitalPage
