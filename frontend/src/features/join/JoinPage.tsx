import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getApi } from '../../api/client'
import type { BloodGroup, Lang } from '../../api/types'
import { LangToggle } from '../../components/LangToggle'
import { ConsentCheckbox } from '../../components/ConsentCheckbox'
import { Button } from '../../components/Button'
import { useT } from '../../i18n/useT'
import {
  Heart,
  ShieldCheck,
  CheckCircle2,
  PhoneCall,
  UserCheck,
  ArrowRight,
  Info,
  Sparkles,
} from 'lucide-react'
import clsx from 'clsx'

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/**
 * Validates Indian 10-digit mobile numbers (starting with 6, 7, 8, or 9).
 * Accepts optional +91 or 0 prefix with spaces/dashes.
 */
function isValidIndianMobile(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '')
  // Accepts: 9876543210, +919876543210, 919876543210, 09876543210
  const indianMobileRegex = /^(?:(?:\+|00)?91|0)?[6789]\d{9}$/
  return indianMobileRegex.test(cleaned)
}

export function JoinPage() {
  const { t, lang } = useT()
  const api = getApi()

  // Form State
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('')
  const [area, setArea] = useState('')
  const [chosenLang, setChosenLang] = useState<Lang | null>(null)
  const selectedLang = chosenLang ?? lang
  const [lastDonation, setLastDonation] = useState('')

  // 4 & 5. Consent Checkboxes (Must be unticked by default)
  const [consentUrgent, setConsentUrgent] = useState(false)
  const [consentHistory, setConsentHistory] = useState(false)
  const [isAdult, setIsAdult] = useState(false)

  // Status & Validation
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(true)
  const [registeredAlias, setRegisteredAlias] = useState<string | null>(null)

  // Check demo mode flag
  useEffect(() => {
    let isMounted = true
    api.getConfig()
      .then((cfg) => {
        if (isMounted) {
          setIsDemoMode(cfg.dataMode === 'demo')
        }
      })
      .catch((err) => console.error('Failed to load AppConfig:', err))
    return () => {
      isMounted = false
    }
  }, [api])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate phone number
    if (!isValidIndianMobile(phone)) {
      setPhoneError(t.join.phoneError)
      return
    }
    setPhoneError(null)

    if (!consentUrgent || !isAdult || !bloodGroup || !name.trim() || !area.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.signupDonor({
        name: name.trim(),
        phone: phone.trim(),
        bloodGroup: bloodGroup as BloodGroup,
        area: area.trim(),
        lang: selectedLang,
        lastDonation: lastDonation || undefined,
        consentUrgent,
        consentHistory,
        adult: isAdult,
      })

      setRegisteredAlias(res.donorAlias)
    } catch (err) {
      console.error('Failed to register donor:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 6. The "Join" button is disabled until urgent-contact consent and 18+ are ticked
  const isFormValid =
    consentUrgent &&
    isAdult &&
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    bloodGroup !== '' &&
    area.trim().length > 0

  // 7. Success Screen: Never display phone number back!
  if (registeredAlias) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div
          role="status"
          aria-live="polite"
          className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--success)] bg-[var(--surface)] text-center space-y-6 shadow-md animate-fade-in text-left sm:text-center"
        >
          <div className="w-16 h-16 rounded-full bg-[var(--success-tint)] text-[var(--success)] flex items-center justify-center mx-auto border border-[var(--success)]/30">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text)]">
              You&apos;re in. Your donor name is {registeredAlias}. You&apos;ll only be called when you match and it&apos;s safe for you to donate.
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
              Your contact details are encrypted and will never be shared publicly or sold. We only reach out for verified hospital requests nearby.
            </p>
          </div>

          {/* 8. Demo mode notice */}
          {isDemoMode && (
            <div className="p-3.5 rounded-xl bg-[var(--demo)]/15 border border-[var(--demo)]/40 text-[var(--text)] text-xs font-semibold flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--demo)] shrink-0" aria-hidden="true" />
              <span>Demo: nothing is sent and no call will be made.</span>
            </div>
          )}

          {/* Privacy confirmation: phone number is explicitly NOT shown */}
          <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--muted)] space-y-1 text-left">
            <div className="flex justify-between font-mono">
              <span>Assigned Public Alias:</span>
              <span className="font-bold text-[var(--text)]">{registeredAlias}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>Registered Group:</span>
              <span className="font-bold text-[var(--primary)]">{bloodGroup}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span>Registered Locality:</span>
              <span className="text-[var(--text)]">{area}</span>
            </div>
            <div className="flex justify-between font-mono pt-1 border-t border-[var(--border)]/60 text-[11px]">
              <span>Phone Privacy:</span>
              <span className="text-[var(--success)] font-semibold">Protected in encrypted vault (omitted from display)</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/sim"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm hover:opacity-95 transition-opacity shadow-xs focus-visible:outline-3 focus-visible:outline-[var(--info)]"
            >
              <PhoneCall className="w-4 h-4" aria-hidden="true" />
              <span>Try Donor Call Simulator</span>
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--border)]/20 transition-colors focus-visible:outline-3 focus-visible:outline-[var(--info)]"
            >
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 text-left py-4">
      {/* 1. LangToggle at the top */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--primary)]">
          <Heart className="w-4 h-4 fill-current" aria-hidden="true" />
          <span>Voluntary Donor Registry</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)] hidden sm:inline">Language:</span>
          <LangToggle />
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text)] tracking-tight">
          {t.join.title} · Join U2U Donor Network
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1.5 leading-relaxed">
          {t.join.subtitle}
        </p>
      </div>

      {/* 2. Short Privacy & Data Collection Notice */}
      <section
        aria-labelledby="privacy-notice-heading"
        className="p-5 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-xs sm:text-sm space-y-3 shadow-2xs"
      >
        <div className="flex items-center gap-2 font-heading font-bold text-sm sm:text-base text-[var(--text)]">
          <Info className="w-4 h-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
          <h2 id="privacy-notice-heading">{t.join.privacyNoticeTitle}</h2>
        </div>

        <ul className="space-y-2 text-[var(--muted)] leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-[var(--text)]">What we collect:</strong> Name, mobile number, blood group, area/pin, preferred call language, and optional last donation date.
          </li>
          <li>
            <strong className="text-[var(--text)]">Why:</strong> Exclusively to relay urgent automated voice calls during clinical shortages matching your group and locality.
          </li>
          <li>
            <strong className="text-[var(--text)]">How to withdraw:</strong> Press 9 on any automated voice call to opt out instantly, or contact us.
          </li>
          <li>
            <strong className="text-[var(--text)]">Grievance contact:</strong> <span className="font-mono text-[var(--text)]">grievance@uyir2uyir.org</span>
          </li>
        </ul>
      </section>

      {/* Main Registration Form: Steps 2, 3, 4, 5, 6 */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-3xl border-2 border-[var(--border)] bg-[var(--surface)] shadow-md space-y-6">
        <h2 className="text-lg font-heading font-bold text-[var(--text)] border-b border-[var(--border)]/60 pb-3 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[var(--primary)]" aria-hidden="true" />
          <span>Donor Information</span>
        </h2>

        {/* 3. Fields: Name & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="donor-name" className="block text-xs font-bold uppercase tracking-wider text-[var(--text)] font-mono">
              {t.join.nameLabel} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="donor-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.join.namePlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus-visible:outline-3 focus-visible:outline-[var(--info)] transition-all"
            />
          </div>

          {/* Phone Number (Indian mobile validation) */}
          <div className="space-y-1.5">
            <label htmlFor="donor-phone" className="block text-xs font-bold uppercase tracking-wider text-[var(--text)] font-mono">
              {t.join.phoneLabel} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="donor-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                if (phoneError) setPhoneError(null)
              }}
              placeholder={t.join.phonePlaceholder}
              className={clsx(
                'w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg)] text-[var(--text)] text-sm focus-visible:outline-3 focus-visible:outline-[var(--info)] transition-all',
                phoneError ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]' : 'border-[var(--border)]',
              )}
            />
            {phoneError && (
              <p className="text-xs font-semibold text-[var(--danger)] mt-1" role="alert">
                {phoneError}
              </p>
            )}
          </div>
        </div>

        {/* Fields: Blood Group & Area */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Blood Group */}
          <div className="space-y-1.5">
            <label htmlFor="donor-blood-group" className="block text-xs font-bold uppercase tracking-wider text-[var(--text)] font-mono">
              {t.join.bloodGroupLabel} <span className="text-[var(--danger)]">*</span>
            </label>
            <select
              id="donor-blood-group"
              required
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus-visible:outline-3 focus-visible:outline-[var(--info)] transition-all font-semibold"
            >
              <option value="">{t.join.bloodGroupPlaceholder}</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          {/* Area / PIN */}
          <div className="space-y-1.5">
            <label htmlFor="donor-area" className="block text-xs font-bold uppercase tracking-wider text-[var(--text)] font-mono">
              {t.join.areaLabel} <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              id="donor-area"
              type="text"
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder={t.join.areaPlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus-visible:outline-3 focus-visible:outline-[var(--info)] transition-all"
            />
          </div>
        </div>

        {/* Fields: Language & Last Donation Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Preferred Call Language */}
          <div className="space-y-1.5">
            <label htmlFor="donor-lang" className="block text-xs font-bold uppercase tracking-wider text-[var(--text)] font-mono">
              {t.join.langLabel}
            </label>
            <select
              id="donor-lang"
              value={selectedLang}
              onChange={(e) => setChosenLang(e.target.value as Lang)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus-visible:outline-3 focus-visible:outline-[var(--info)] transition-all"
            >
              <option value="en">English</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
          </div>

          {/* Optional Last Donation Date */}
          <div className="space-y-1.5">
            <label htmlFor="donor-last-donation" className="block text-xs font-bold uppercase tracking-wider text-[var(--text)] font-mono">
              {t.join.lastDonationLabel}
            </label>
            <input
              id="donor-last-donation"
              type="date"
              value={lastDonation}
              onChange={(e) => setLastDonation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus-visible:outline-3 focus-visible:outline-[var(--info)] transition-all"
            />
          </div>
        </div>

        {/* 4 & 5. Consent Checkboxes: Must be unticked by default */}
        <div className="space-y-3 pt-3 border-t border-[var(--border)]/60">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--muted)]">
            Purpose-Specific Consent &amp; Attestation
          </h3>

          {/* Consent 1: Urgent Call Outreach (Mandatory) */}
          <ConsentCheckbox
            id="consent-urgent"
            checked={consentUrgent}
            onChange={setConsentUrgent}
            required
            label="U2U may call me when someone near me needs my blood group."
            description="Required. Automated emergency voice calls in your registered area when blood is urgently needed."
          />

          {/* Consent 2: Donation History (Optional) */}
          <ConsentCheckbox
            id="consent-history"
            checked={consentHistory}
            onChange={setConsentHistory}
            label="U2U may keep my donation history so I'm not called too early."
            description="Optional. Tracks donation timestamps so you are not disturbed during medical safe intervals (e.g. 90 days)."
          />

          {/* Consent 3: 18+ Age Attestation (Mandatory) */}
          <ConsentCheckbox
            id="consent-adult"
            checked={isAdult}
            onChange={setIsAdult}
            required
            label="I confirm that I am 18 years of age or older."
            description="Required. Blood donors in India must be at least 18 years old per NBTC transfusion regulations."
          />
        </div>

        {/* Privacy Note */}
        <div className="p-3.5 rounded-xl bg-[var(--border)]/15 border border-[var(--border)]/50 text-xs text-[var(--muted)] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
          <span>Your contact details are encrypted. Only an anonymous alias is ever shared with staff.</span>
        </div>

        {/* 6. Join Button: Disabled until urgent consent and 18+ are ticked */}
        <div className="pt-2">
          <Button
            variant="primary"
            type="submit"
            disabled={!isFormValid || isSubmitting}
            isLoading={isSubmitting}
            className="w-full sm:w-auto min-w-[180px] font-bold shadow-sm"
          >
            <span>{isSubmitting ? t.join.joining : t.join.joinButton}</span>
            <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
          </Button>

          {(!consentUrgent || !isAdult) && (
            <p className="text-xs text-[var(--muted)] mt-2 italic">
              * Please tick the urgent-contact consent and 18+ attestation above to enable registration.
            </p>
          )}
        </div>
      </form>
    </div>
  )
}

export default JoinPage
