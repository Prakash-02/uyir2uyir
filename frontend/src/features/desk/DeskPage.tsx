import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getApi } from '../../api/client'
import type { DeskResult } from '../../api/types'
import { SAMPLE_MESSAGES, type SampleMessage } from '../../api/mock/desk'
import { TracePanel } from '../../components/TracePanel'
import { Button } from '../../components/Button'
import { useT } from '../../i18n/useT'
import {
  ShieldCheck,
  Send,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  RotateCcw,
  ExternalLink,
  Shield,
  HelpCircle,
} from 'lucide-react'
import clsx from 'clsx'

export function DeskPage() {
  const { t } = useT()
  const api = getApi()

  const [text, setText] = useState('')
  const [submittedText, setSubmittedText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DeskResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = async (messageToCheck?: string) => {
    const raw = (messageToCheck ?? text).trim()
    if (!raw || isLoading) return

    setIsLoading(true)
    setError(null)
    setSubmittedText(raw)

    try {
      const res = await api.checkDesk(raw)
      setResult(res)
    } catch (err) {
      console.error('Failed to check desk message:', err)
      setError("Couldn't check right now. Please call the hospital.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectSample = (sample: SampleMessage) => {
    setText(sample.text)
    setError(null)
  }

  const handleClear = () => {
    setText('')
    setSubmittedText('')
    setResult(null)
    setError(null)
  }

  const hasPayment = Boolean(result?.trace.paymentPhrases && result.trace.paymentPhrases.length > 0)
  const hospitalName = result?.hospitalName || 'the hospital'

  return (
    <div className="space-y-8 max-w-4xl mx-auto text-left">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--primary)] mb-1">
          <Shield className="w-4 h-4" aria-hidden="true" />
          <span>Public Verification Desk</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text)] tracking-tight">
          {t.desk.title}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
          {t.desk.subtitle}
        </p>
      </div>

      {/* Main Input Card: Steps 1, 2, 6, 7 */}
      <section
        aria-label="Message Verification Form"
        className="p-5 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs space-y-5"
      >
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="desk-message-input"
            id="message-input-heading"
            className="block text-sm sm:text-base font-heading font-bold text-[var(--text)]"
          >
            Paste the message you received
          </label>
          {/* Character counter (2,000 max) */}
          <span
            aria-live="polite"
            className={clsx(
              'text-xs font-mono px-2 py-0.5 rounded-full border',
              text.length > 1900
                ? 'bg-[var(--danger-tint)] text-[var(--danger)] border-[var(--danger)]/30 font-bold'
                : 'bg-[var(--border)]/30 text-[var(--muted)] border-[var(--border)]/50',
            )}
          >
            {text.length.toLocaleString()} / 2,000
          </span>
        </div>

        {/* Big Textarea */}
        <div className="relative">
          <textarea
            id="desk-message-input"
            rows={5}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.desk.textareaPlaceholder}
            className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm sm:text-base leading-relaxed focus-visible:outline-3 focus-visible:outline-[var(--info)] transition-all resize-y min-h-[140px]"
          />
        </div>

        {/* 6. Privacy Note Under the Box */}
        <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 font-medium">
          <HelpCircle className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <span>We don't keep your message. Only the extracted details are checked.</span>
        </p>

        {/* 2. Try a Sample Chips */}
        <div className="space-y-2 pt-2 border-t border-[var(--border)]/60">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider font-mono">
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" aria-hidden="true" />
            <span>Try a sample</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {SAMPLE_MESSAGES.map((sample) => {
              const isSelected = text === sample.text
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  aria-pressed={isSelected}
                  className={clsx(
                    'text-xs font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none',
                    'focus-visible:outline-3 focus-visible:outline-[var(--info)]',
                    isSelected
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-semibold'
                      : 'bg-[var(--border)]/20 hover:bg-[var(--border)]/40 text-[var(--text)] border-[var(--border)] hover:border-[var(--muted)]',
                  )}
                >
                  {sample.title}
                </button>
              )
            })}
          </div>
        </div>

        {/* Action Buttons: 1 & 7 */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {text.length > 0 && (
            <Button
              variant="ghost"
              type="button"
              onClick={handleClear}
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              <span>Clear</span>
            </Button>
          )}

          <div className="ml-auto">
            <Button
              variant="primary"
              type="button"
              onClick={() => handleCheck()}
              disabled={text.trim().length === 0 || isLoading}
              isLoading={isLoading}
              className="min-w-[150px] shadow-sm font-bold"
            >
              {isLoading ? 'Checking…' : 'Check message'}
            </Button>
          </div>
        </div>

        {/* 7. Error State */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-tint)] text-[var(--danger)] text-sm flex items-center gap-3 animate-fade-in"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <p className="font-semibold">{error}</p>
          </div>
        )}
      </section>

      {/* 3 & 4. Answer Card Shown First, aria-live="assertive" */}
      {result && (
        <section
          aria-live="assertive"
          aria-labelledby="desk-answer-title"
          className="space-y-6 animate-fade-in"
        >
          <div
            className={clsx(
              'rounded-3xl border-2 overflow-hidden shadow-md text-left transition-all',
              result.answer === 'VERIFIED_MATCH'
                ? 'border-[var(--success)] bg-[var(--surface)]'
                : result.answer === 'SENT_TO_HOSPITAL'
                  ? 'border-[var(--warning)] bg-[var(--surface)]'
                  : 'border-[var(--danger)] bg-[var(--surface)]',
            )}
          >
            {/* Top Answer Badge Strip */}
            <div
              className={clsx(
                'px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-between',
                result.answer === 'VERIFIED_MATCH'
                  ? 'bg-[var(--success-tint)] text-[var(--success)]'
                  : result.answer === 'SENT_TO_HOSPITAL'
                    ? 'bg-[var(--warning-tint)] text-[var(--warning)]'
                    : 'bg-[var(--danger-tint)] text-[var(--danger)]',
              )}
            >
              <span id="desk-answer-title">
                {result.answer === 'VERIFIED_MATCH'
                  ? 'Verified Hospital Request'
                  : result.answer === 'SENT_TO_HOSPITAL'
                    ? 'Awaiting Hospital Confirmation'
                    : 'Unverified Request'}
              </span>
              <span className="text-[11px] font-normal opacity-80">U2U Trust Desk</span>
            </div>

            {/* Answer Body with Big Icon */}
            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Big Icon */}
                <div className="shrink-0">
                  {result.answer === 'VERIFIED_MATCH' ? (
                    <div className="w-16 h-16 rounded-2xl bg-[var(--success-tint)] text-[var(--success)] border-2 border-[var(--success)]/30 flex items-center justify-center shadow-xs">
                      <ShieldCheck className="w-9 h-9" aria-hidden="true" />
                    </div>
                  ) : result.answer === 'SENT_TO_HOSPITAL' ? (
                    <div className="w-16 h-16 rounded-2xl bg-[var(--warning-tint)] text-[var(--warning)] border-2 border-[var(--warning)]/30 flex items-center justify-center shadow-xs">
                      <Send className="w-9 h-9" aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-[var(--danger-tint)] text-[var(--danger)] border-2 border-[var(--danger)]/30 flex items-center justify-center shadow-xs">
                      <ShieldAlert className="w-9 h-9" aria-hidden="true" />
                    </div>
                  )}
                </div>

                {/* Primary Answer Copy */}
                <div className="space-y-2 min-w-0 flex-1">
                  {result.answer === 'VERIFIED_MATCH' ? (
                    <>
                      <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text)] leading-snug">
                        This request is verified. Donors are already being called.
                      </h2>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        Matches an active clinical order at {hospitalName}. Automated voice outreach is already in progress.
                      </p>
                    </>
                  ) : result.answer === 'SENT_TO_HOSPITAL' ? (
                    <>
                      <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text)] leading-snug">
                        We've asked {hospitalName}'s blood bank to confirm. Please also call them.
                      </h2>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        A secure one-tap alert was dispatched to the registered hospital blood bank. Please reach the hospital directly for emergency coordination.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--danger)] leading-snug">
                        Couldn't verify. Please call the hospital directly.
                      </h2>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">
                        The message could not be matched with a registered hospital or verified patient reference. Do not forward unverified requests.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Warning Line if paymentPhrases is not empty */}
              {hasPayment && (
                <div
                  role="alert"
                  className="p-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-tint)] text-[var(--danger)] flex items-start gap-3 shadow-2xs"
                >
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <p className="font-heading font-bold">
                      This message mentions payment. Blood donation in India is voluntary and unpaid.
                    </p>
                    <p className="text-xs opacity-90">
                      Under National Blood Transfusion Council regulations, commercial blood solicitation or offering cash conveyance is illegal.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Link for VERIFIED_MATCH or Demo Review link for SENT_TO_HOSPITAL */}
              {result.answer === 'VERIFIED_MATCH' && (
                <div className="pt-2">
                  <Link
                    to="/hospital"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white font-semibold text-xs sm:text-sm hover:opacity-95 transition-opacity shadow-xs focus-visible:outline-3 focus-visible:outline-[var(--info)]"
                  >
                    <span>Check live request status</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </Link>
                </div>
              )}

              {result.answer === 'SENT_TO_HOSPITAL' && result.demoConfirmToken && (
                <div className="pt-2">
                  <Link
                    to={`/confirm/${result.demoConfirmToken}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--warning-tint)] text-[var(--warning)] border border-[var(--warning)]/30 font-semibold text-xs sm:text-sm hover:bg-[var(--warning-tint)]/80 transition-colors shadow-2xs focus-visible:outline-3 focus-visible:outline-[var(--info)]"
                  >
                    <span>Staff review link (demo)</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>

            {/* 4. Fixed Footer Stripe on Every Answer in Both Languages */}
            <div className="px-6 py-4 bg-[var(--text)] text-[var(--surface)] border-t border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-inner">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
                <p className="font-heading font-bold text-sm tracking-tight text-[var(--surface)]">
                  Nobody may charge you for a donor.
                </p>
              </div>

              <p
                lang="ta"
                className="text-xs font-semibold text-[var(--surface)]/80"
              >
                இரத்த தானத்திற்கு யாரும் உங்களிடம் கட்டணம் வசூலிக்கக் கூடாது.
              </p>
            </div>
          </div>

          {/* 5. Collapsible TracePanel: "How U2U checked this" */}
          <TracePanel
            trace={result.trace}
            rawText={submittedText}
            defaultOpen={true}
          />
        </section>
      )}
    </div>
  )
}

export default DeskPage
