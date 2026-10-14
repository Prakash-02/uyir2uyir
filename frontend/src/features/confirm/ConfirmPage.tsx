import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getApi } from '../../api/client'
import type { RequestPreview, BloodRequest, ConfirmAction } from '../../api/types'
import { Button } from '../../components/Button'
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Building2,
  Lock,
  ArrowRight,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react'

export function ConfirmPage() {
  const { token } = useParams<{ token: string }>()
  const api = getApi()

  const [preview, setPreview] = useState<RequestPreview | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(token))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorState, setErrorState] = useState<'EXPIRED' | 'LOAD_ERROR' | null>(() =>
    !token ? 'EXPIRED' : null,
  )

  // Result state after action
  const [resultState, setResultState] = useState<'RAISED' | 'REJECTED' | null>(null)
  const [createdRequest, setCreatedRequest] = useState<BloodRequest | null>(null)

  useEffect(() => {
    if (!token) {
      return
    }

    let isMounted = true

    api.getConfirmPreview(token)
      .then((data) => {
        if (isMounted) {
          setPreview(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load confirm preview:', err)
        if (isMounted) {
          setErrorState('EXPIRED')
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [api, token])

  const handleAction = async (action: ConfirmAction) => {
    if (!token || isSubmitting) return
    setIsSubmitting(true)

    try {
      const res = await api.confirmRequest(token, action)
      if (action === 'NOT_OUR_PATIENT' || ('status' in res && res.status === 'REJECTED')) {
        setResultState('REJECTED')
      } else {
        setResultState('RAISED')
        setCreatedRequest(res as BloodRequest)
      }
    } catch (err) {
      console.error('Failed to submit confirmation action:', err)
      setErrorState('EXPIRED')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-[var(--muted)]">Loading request preview…</p>
      </div>
    )
  }

  // 2. Result State: Raised
  if (resultState === 'RAISED') {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div
          role="status"
          aria-live="polite"
          className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--success)] bg-[var(--surface)] text-center space-y-6 shadow-md animate-fade-in"
        >
          <div className="w-16 h-16 rounded-full bg-[var(--success-tint)] text-[var(--success)] flex items-center justify-center mx-auto border border-[var(--success)]/30">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-heading font-bold text-[var(--text)]">
              Request raised successfully
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
              Emergency donor outreach has started for{' '}
              <strong className="text-[var(--text)]">
                {createdRequest?.unitsNeeded ?? preview?.unitsNeeded} units of{' '}
                {createdRequest?.bloodGroup ?? preview?.bloodGroup} {createdRequest?.component ?? preview?.component}
              </strong>{' '}
              at {createdRequest?.hospitalName ?? preview?.hospitalName}.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs font-mono text-[var(--muted)] space-y-1">
            <div className="flex justify-between">
              <span>Request ID:</span>
              <span className="font-bold text-[var(--text)]">{createdRequest?.id ?? 'req-confirmed'}</span>
            </div>
            <div className="flex justify-between">
              <span>Patient Reference:</span>
              <span className="text-[var(--text)]">CONFIRMED-DESK</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/hospital"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-95 transition-opacity shadow-xs focus-visible:outline-3 focus-visible:outline-[var(--info)]"
            >
              <span>View live request status</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              to="/centre"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--border)]/20 transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)]"
            >
              <span>Go to Blood Centre</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 3. Result State: Rejected ("Not our patient")
  if (resultState === 'REJECTED') {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div
          role="status"
          aria-live="polite"
          className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--border)] bg-[var(--surface)] text-center space-y-6 shadow-md animate-fade-in"
        >
          <div className="w-16 h-16 rounded-full bg-[var(--border)]/30 text-[var(--muted)] flex items-center justify-center mx-auto">
            <XCircle className="w-9 h-9" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-heading font-bold text-[var(--text)]">
              Request rejected
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
              This message was marked as <strong className="text-[var(--text)]">Not our patient</strong> by the hospital blood bank. No emergency calls will be placed.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/hospital"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--border)]/20 transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)]"
            >
              <span>Back to Hospital Desk</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 4. Result State: Expired or used link
  if (errorState === 'EXPIRED' || !preview) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div
          role="alert"
          className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--warning)] bg-[var(--surface)] text-center space-y-6 shadow-md animate-fade-in"
        >
          <div className="w-16 h-16 rounded-full bg-[var(--warning-tint)] text-[var(--warning)] flex items-center justify-center mx-auto border border-[var(--warning)]/30">
            <AlertCircle className="w-9 h-9" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-heading font-bold text-[var(--text)]">
              This confirmation link has expired, was already used, or is invalid.
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
              Confirmation tokens are single-use and expire quickly to protect patient safety. If a request is still needed, the hospital blood bank can raise one directly.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/hospital"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-95 transition-opacity shadow-xs focus-visible:outline-3 focus-visible:outline-[var(--info)]"
            >
              <span>Go to Hospital Desk</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              to="/desk"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--border)]/20 transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)]"
            >
              <span>Public Request Desk</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 5. Active Preview Screen: Step 1
  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left py-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--warning)] mb-1">
          <Building2 className="w-4 h-4" aria-hidden="true" />
          <span>Hospital Blood Bank Review</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text)] tracking-tight">
          Confirm Hospital Blood Request
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          A forwarded message for your hospital was submitted at the public Request Desk. Review the extracted clinical details below.
        </p>
      </div>

      {/* Request Preview Card */}
      <section
        aria-label="Extracted Request Preview"
        className="p-6 sm:p-7 rounded-3xl border-2 border-[var(--border)] bg-[var(--surface)] shadow-md space-y-6"
      >
        {/* Hospital Header Banner */}
        <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--muted)] block">
              Destination Hospital
            </span>
            <p className="font-heading font-bold text-base sm:text-lg text-[var(--text)]">
              {preview.hospitalName}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[var(--warning-tint)] text-[var(--warning)] border border-[var(--warning)]/30 text-xs font-mono font-bold shrink-0">
            Awaiting Confirmation
          </span>
        </div>

        {/* Clinical Grid: Blood Group, Component, Units, Masked Patient Ref */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Blood Group */}
          <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
            <span className="text-[11px] font-mono text-[var(--muted)] block">Blood Group</span>
            <span className="font-heading font-bold text-2xl text-[var(--primary)] mt-1 block">
              {preview.bloodGroup}
            </span>
          </div>

          {/* Component */}
          <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
            <span className="text-[11px] font-mono text-[var(--muted)] block">Component</span>
            <span className="font-heading font-semibold text-sm text-[var(--text)] mt-1 block truncate">
              {preview.component}
            </span>
          </div>

          {/* Units */}
          <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
            <span className="text-[11px] font-mono text-[var(--muted)] block">Units Needed</span>
            <span className="font-heading font-bold text-2xl text-[var(--text)] mt-1 block tnum">
              {preview.unitsNeeded}
            </span>
          </div>

          {/* Masked Patient Reference */}
          <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
            <span className="text-[11px] font-mono text-[var(--muted)] block flex items-center gap-1">
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span>Patient Ref</span>
            </span>
            <span className="font-mono font-bold text-sm text-[var(--text)] mt-1 block">
              {preview.patientRefMasked}
            </span>
          </div>
        </div>

        {/* Privacy & Safeguard Explainer */}
        <div className="p-4 rounded-2xl bg-[var(--info-tint)] border border-[var(--info)]/30 text-xs text-[var(--text)] flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-[var(--info)] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-[var(--info)]">
              Patient Privacy &amp; Verification Rule
            </p>
            <p className="leading-relaxed opacity-90">
              Patient references remain masked until verified by staff. If this patient is admitted and in clinical need, click <strong>Raise this request</strong> to immediately initiate automated donor phone calls.
            </p>
          </div>
        </div>

        {/* Expiration Note */}
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted)] pt-1 border-t border-[var(--border)]/60">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Token valid until {new Date(preview.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {/* Step 1 Actions: Primary "Raise this request", Ghost "Not our patient" */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="ghost"
            type="button"
            onClick={() => handleAction('NOT_OUR_PATIENT')}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-xs sm:text-sm text-[var(--danger)] hover:bg-[var(--danger-tint)] hover:text-[var(--danger)]"
          >
            Not our patient
          </Button>

          <Button
            variant="primary"
            type="button"
            onClick={() => handleAction('RAISE')}
            disabled={isSubmitting}
            isLoading={isSubmitting}
            className="w-full sm:w-auto font-bold shadow-sm"
          >
            <Sparkles className="w-4 h-4 mr-1.5" aria-hidden="true" />
            <span>Raise this request</span>
          </Button>
        </div>
      </section>
    </div>
  )
}

export default ConfirmPage
