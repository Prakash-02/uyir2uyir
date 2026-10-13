import { useState } from 'react'
import { Logo } from '../../components/Logo'
import { Button } from '../../components/Button'
import { Card, CardHeader } from '../../components/Card'
import { StatusBadge } from '../../components/StatusBadge'
import { DemoBanner } from '../../components/DemoBanner'
import { LangToggle } from '../../components/LangToggle'
import { ThemeToggle } from '../../components/ThemeToggle'
import { ProgressBanner } from '../../components/ProgressBanner'
import { Timeline } from '../../components/Timeline'
import { CallRow } from '../../components/CallRow'
import { Field, Input, Select, Textarea } from '../../components/Field'
import { ConsentCheckbox } from '../../components/ConsentCheckbox'
import { Keypad } from '../../components/Keypad'
import { TracePanel } from '../../components/TracePanel'
import { StatTile } from '../../components/StatTile'
import { Toast } from '../../components/Toast'
import type { RequestStatus, CallState, SimKey, TimelineEvent, DeskResult } from '../../api/types'
import type { DeskAnswer } from '../../components/StatusBadge'
import type { ToastVariant } from '../../components/Toast'
import {
  Plus,
  ArrowRight,
  Heart,
  CheckCircle2,
  Bell,
} from 'lucide-react'

export function StyleguidePage() {
  const [btnLoading, setBtnLoading] = useState(false)
  const [activeKey, setActiveKey] = useState<SimKey | null>('1')
  const [consent1, setConsent1] = useState(false)
  const [consent2, setConsent2] = useState(true)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastVariant, setToastVariant] = useState<ToastVariant>('info')
  const [toastTitle, setToastTitle] = useState('Outreach Initiated')
  const [toastDesc, setToastDesc] = useState('Contacting 4 nearby registered O+ donors.')

  const triggerToast = (variant: ToastVariant, title: string, desc: string) => {
    setToastVariant(variant)
    setToastTitle(title)
    setToastDesc(desc)
    setToastOpen(false)
    setTimeout(() => setToastOpen(true), 50)
  }

  const requestStatuses: RequestStatus[] = [
    'OPEN',
    'PAUSED',
    'FULFILLED',
    'AWAITING_HOSPITAL',
    'EXPIRED',
    'CANCELLED',
    'REJECTED',
  ]

  const callStates: CallState[] = [
    'QUEUED',
    'DIALING',
    'RINGING',
    'ON_THE_WAY',
    'ACCEPTED',
    'DEFERRED',
    'DECLINED',
    'NO_ANSWER',
    'UNKNOWN',
    'OPTED_OUT',
    'LATE_ACCEPT',
    'CANCELLED',
  ]

  const deskAnswers: DeskAnswer[] = ['VERIFIED_MATCH', 'SENT_TO_HOSPITAL', 'NOT_VERIFIED']

  const colorSwatches = [
    { name: '--bg', label: 'Canvas / Warm Paper', bg: 'bg-[var(--bg)]', text: 'text-[var(--text)]' },
    { name: '--surface', label: 'Surface Container', bg: 'bg-[var(--surface)]', text: 'text-[var(--text)]' },
    { name: '--text', label: 'Warm Ink Typography', bg: 'bg-[var(--text)]', text: 'text-[var(--bg)]' },
    { name: '--muted', label: 'Muted Meta / Labels', bg: 'bg-[var(--muted)]', text: 'text-white' },
    { name: '--border', label: 'Borders & Outlines', bg: 'bg-[var(--border)]', text: 'text-[var(--text)]' },
    { name: '--primary', label: 'Crimson Accent', bg: 'bg-[var(--primary)]', text: 'text-[var(--primary-on)]' },
    { name: '--success', label: 'Fulfilled / Verified', bg: 'bg-[var(--success)]', text: 'text-white' },
    { name: '--success-tint', label: 'Success Tint Container', bg: 'bg-[var(--success-tint)]', text: 'text-[var(--success)]' },
    { name: '--warning', label: 'Paused / Hospital Alert', bg: 'bg-[var(--warning)]', text: 'text-white' },
    { name: '--warning-tint', label: 'Warning Tint Container', bg: 'bg-[var(--warning-tint)]', text: 'text-[var(--warning)]' },
    { name: '--danger', label: 'Unverified / Opt-out', bg: 'bg-[var(--danger)]', text: 'text-white' },
    { name: '--danger-tint', label: 'Danger Tint Container', bg: 'bg-[var(--danger-tint)]', text: 'text-[var(--danger)]' },
    { name: '--info', label: 'Dialer Round / Links', bg: 'bg-[var(--info)]', text: 'text-white' },
    { name: '--info-tint', label: 'Info Tint Container', bg: 'bg-[var(--info-tint)]', text: 'text-[var(--info)]' },
    { name: '--demo', label: 'Simulated Banner', bg: 'bg-[var(--demo)]', text: 'text-[#1C1917]' },
  ]

  const sampleEvents: TimelineEvent[] = [
    {
      id: 'e1',
      requestId: 'req-1',
      at: '2026-10-14T01:10:00.000Z',
      kind: 'DISPATCH',
      text: 'Round 1 dispatch initiated to 4 registered O+ donors in Adyar area.',
    },
    {
      id: 'e2',
      requestId: 'req-1',
      at: '2026-10-14T01:12:00.000Z',
      kind: 'IVR',
      text: 'Donor A7 confirmed commitment (pressed 1). ETA: 18 min.',
    },
    {
      id: 'e3',
      requestId: 'req-1',
      at: '2026-10-14T01:13:30.000Z',
      kind: 'PAUSE',
      text: 'Reached target (1 accepted + 2 on the way = 3 covered vs N=2). Automated dialer paused.',
    },
    {
      id: 'e4',
      requestId: 'req-1',
      at: '2026-10-14T01:15:00.000Z',
      kind: 'SCREENING',
      text: 'Donor A7 arrived at Apollo Blood Centre. Centre staff initiated medical screening.',
    },
  ]

  const sampleTrace: DeskResult['trace'] = {
    hospital: { value: 'Apollo Hospital Greams Road', quote: 'Apollo Hospital', kept: true },
    patientNumber: { value: 'IP-84920', quote: 'IP-84920', kept: true },
    bloodGroup: { value: 'O+', quote: 'O positive', kept: true },
    component: { value: 'RED_CELLS', quote: 'PRBC 2 units', kept: true },
    units: { value: 2, quote: '2 units', kept: true },
    paymentPhrases: ['Donor will be compensated ₹3,000 cash'],
    geminiChoice: 'EXTRACT: Apollo Hospital, IP-84920, O+, RED_CELLS, 2 units. Detected payment phrase: "compensated ₹3,000".',
    codeDecision: 'NOT_VERIFIED: Payment solicitation detected in message body. Outreach strictly denied per NBTC standards.',
  }

  const sampleRawText = `URGENT BLOOD REQUIREMENT:
Patient in ICU at Apollo Hospital, Greams Road (IP-84920).
Needs 2 units of O positive PRBC immediately for emergency surgery.
Donor will be compensated ₹3,000 cash for conveyance.
Please contact blood bank directly.`

  return (
    <div className="space-y-12 pb-24 text-left">
      {/* Toast Notification Mount */}
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        variant={toastVariant}
        title={toastTitle}
        description={toastDesc}
      />

      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-heading text-[var(--text)]">
              U2U Design System Styleguide
            </h1>
            <p className="text-base text-[var(--muted)] mt-1">
              Design tokens, typography, brand marks, and 14 accessible core components.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* 1. Brand Logo */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          1. Brand Logo & Mark
        </h2>
        <Card>
          <div className="flex flex-wrap items-center gap-8">
            <div className="space-y-1">
              <span className="text-xs text-[var(--muted)] block">Small (28px)</span>
              <Logo size="sm" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-[var(--muted)] block">Medium (36px Standard)</span>
              <Logo size="md" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-[var(--muted)] block">Large (48px Hero)</span>
              <Logo size="lg" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-[var(--muted)] block">Mark Only</span>
              <Logo size="lg" showWordmark={false} />
            </div>
          </div>
        </Card>
      </section>

      {/* 2. Color Tokens */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          2. Color Tokens (Warm Paper & Crimson Thread)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {colorSwatches.map(({ name, label, bg, text }) => (
            <div
              key={name}
              className={`p-3.5 rounded-lg border border-[var(--border)] ${bg} ${text} shadow-xs flex flex-col justify-between h-24`}
            >
              <span className="font-mono text-xs font-semibold">{name}</span>
              <span className="text-xs font-medium opacity-90 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Typography */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          3. Typography (Anek Tamil, Noto Sans & Noto Sans Tamil)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="English Typography" subtitle="Noto Sans body & Anek Tamil tabular numbers" />
            <div className="space-y-3">
              <h1 className="text-2xl font-bold font-heading">H1 Title (30px / 1.25)</h1>
              <h2 className="text-xl font-semibold font-heading">H2 Section Header (24px / 1.3)</h2>
              <h3 className="text-lg font-medium font-heading">H3 Subsection Header (20px / 1.4)</h3>
              <p className="text-base text-[var(--text)] leading-relaxed">
                Body text (16px, line-height 1.5): Relaying urgent blood requests from verified hospitals to nearby consented donors via automated calls.
              </p>
              <div className="text-3xl font-bold font-heading text-[var(--primary)] tnum">
                Impact Numbers: 44 · 12:45 · 98.6%
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Tamil Typography" subtitle="Noto Sans Tamil 17px body with 1.6 line-height" />
            <div className="space-y-3" lang="ta">
              <h1 className="text-2xl font-bold font-heading">உயிர்2உயிர் தலைப்பு (30px)</h1>
              <h2 className="text-xl font-semibold font-heading">இரத்ததான அழைப்பு சேவை (24px)</h2>
              <h3 className="text-lg font-medium font-heading">நிகழ்நேர ஒருங்கிணைப்பு (20px)</h3>
              <p className="text-[17px] leading-[1.6] text-[var(--text)]">
                அவசர இரத்தத் தேவைகளுக்கான தொலைபேசி அழைப்பு சேவை. உயிர் தொடர்கிறது. இலவசமாக. பாதுகாப்பாக. நேரத்தில். எவரும் உங்களிடம் இரத்ததானத்திற்காக பணம் கேட்க முடியாது.
              </p>
              <div className="text-xs text-[var(--muted)] font-mono">
                Rule: text-transform: none !important (Never all-caps for Tamil)
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 4. Button Component */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
          <h2 className="text-xl font-bold font-heading text-[var(--text)]">
            4. Button (48px Minimum Touch Target)
          </h2>
          <Button
            variant="ghost"
            onClick={() => setBtnLoading(!btnLoading)}
            className="text-xs min-h-[40px] px-3 py-1.5"
          >
            Toggle Loading State ({btnLoading ? 'ON' : 'OFF'})
          </Button>
        </div>

        <Card>
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-3">
                Variants (Primary Crimson, Secondary Outlined, Ghost)
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" isLoading={btnLoading}>
                  Primary Crimson Action
                </Button>
                <Button variant="secondary" isLoading={btnLoading}>
                  Secondary Action
                </Button>
                <Button variant="ghost" isLoading={btnLoading}>
                  Ghost Action
                </Button>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-3">
                With Icon Slots
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                  Raise Request
                </Button>
                <Button variant="secondary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  View Triage
                </Button>
                <Button variant="ghost" leftIcon={<Heart className="w-4 h-4 text-[var(--primary)]" />}>
                  Thank Donor
                </Button>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-3">
                States (Loading, Disabled, Tamil Script)
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" isLoading>
                  Saving Request
                </Button>
                <Button variant="secondary" disabled>
                  Disabled State
                </Button>
                <Button variant="primary" lang="ta">
                  இரத்தம் தேவை
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 5. StatusBadge Component */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          5. StatusBadge (Icon + Word, Never Color Alone)
        </h2>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Request Statuses" subtitle="All 7 BloodRequest lifecycle states with explicit Lucide icons" />
            <div className="flex flex-wrap items-center gap-2.5">
              {requestStatuses.map((st) => (
                <StatusBadge key={st} status={st} kind="request" />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Donor Call States" subtitle="All 12 IVR states (including animated pulse on RINGING and PhoneOff on CANCELLED)" />
            <div className="flex flex-wrap items-center gap-2.5">
              {callStates.map((st) => (
                <StatusBadge key={st} status={st} kind="call" />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Request Desk Answers" subtitle="Exactly 3 deterministic verification results" />
            <div className="flex flex-wrap items-center gap-2.5">
              {deskAnswers.map((st) => (
                <StatusBadge key={st} status={st} kind="desk" />
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* 6. DemoBanner */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          6. DemoBanner (Persistent Orange Status Alert)
        </h2>
        <Card className="p-0 overflow-hidden">
          <DemoBanner />
          <div className="p-4 bg-[var(--surface)] text-xs text-[var(--muted)]">
            Persistent top bar in demo mode with <code>role=&quot;status&quot;</code>, <code>aria-live=&quot;polite&quot;</code>, and prominent contrast.
          </div>
        </Card>
      </section>

      {/* 7. ProgressBanner */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          7. ProgressBanner (Live Outreach Summary & Fill Animation)
        </h2>
        <div className="space-y-4">
          <ProgressBanner
            unitsNeeded={2}
            accepted={0}
            onTheWay={1}
            label="Outreach Round 1 — 1 donor on the way of 2 needed"
          />
          <ProgressBanner
            unitsNeeded={2}
            accepted={1}
            onTheWay={2}
            label="Standby Rule Triggered — Covered reaches N+1 (3 of 2 covered)"
          />
          <ProgressBanner
            unitsNeeded={2}
            accepted={2}
            onTheWay={0}
            label="Request Fulfilled — Target 2 units accepted by centre staff"
          />
        </div>
      </section>

      {/* 8. Timeline */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          8. Timeline (Chronological Dispatch & IVR Stream)
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-2">
              With Live Events (150ms Fade-in)
            </span>
            <Timeline events={sampleEvents} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-2">
              Empty State
            </span>
            <Timeline events={[]} emptyMessage="No dialer events logged yet for this request." />
          </div>
        </div>
      </section>

      {/* 9. CallRow */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          9. CallRow (Donor Alias, Distance, ETA Chip & Action Trigger)
        </h2>
        <Card className="space-y-3">
          <CallRow
            donorAlias="Donor A7"
            bloodGroup="O+"
            state="ON_THE_WAY"
            distanceKm={2.4}
            etaMinutes={18}
            round={1}
            action={
              <Button variant="secondary" className="min-h-[40px] px-3 py-1.5 text-xs">
                View ETA
              </Button>
            }
          />
          <CallRow
            donorAlias="Donor B3"
            bloodGroup="O+"
            state="ACCEPTED"
            distanceKm={1.1}
            etaMinutes={0}
            round={1}
            action={
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--success)]">
                <CheckCircle2 className="w-4 h-4" />
                Screened
              </span>
            }
          />
          <CallRow
            donorAlias="Donor C1"
            bloodGroup="O+"
            state="RINGING"
            distanceKm={4.8}
            etaMinutes={null}
            round={2}
          />
          <CallRow
            donorAlias="Donor D9"
            bloodGroup="O+"
            state="CANCELLED"
            distanceKm={3.5}
            etaMinutes={null}
            round={1}
          />
        </Card>
      </section>

      {/* 10. Form Field & Primitives */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          10. Form Field & Controls (48px Touch Targets, No Placeholder-Only Inputs)
        </h2>
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field
              id="f-blood-group"
              label="Blood Group"
              hint="Required component matching patient blood type."
              required
            >
              <Select id="f-blood-group" defaultValue="O+">
                <option value="O+">O Positive (O+)</option>
                <option value="O-">O Negative (O-)</option>
                <option value="A+">A Positive (A+)</option>
                <option value="B+">B Positive (B+)</option>
                <option value="AB+">AB Positive (AB+)</option>
              </Select>
            </Field>

            <Field
              id="f-units"
              label="Units Needed (N)"
              hint="Outreach will seek N+1 donors to provide one standby."
              required
            >
              <Input
                id="f-units"
                type="number"
                min={1}
                max={10}
                defaultValue={2}
              />
            </Field>

            <Field
              id="f-patient-ref"
              label="Patient Reference (Staff View Only)"
              error="Patient reference must be between 3 and 30 characters."
            >
              <Input
                id="f-patient-ref"
                defaultValue="P"
                hasError
              />
            </Field>

            <Field
              id="f-desk-msg"
              label="Forwarded Request Message"
              hint="Paste WhatsApp or SMS message forwarded by family."
            >
              <Textarea
                id="f-desk-msg"
                placeholder="Paste forwarded emergency message here..."
                defaultValue="Urgent requirement for O+ blood at Apollo Greams Road..."
              />
            </Field>
          </div>
        </Card>
      </section>

      {/* 11. ConsentCheckbox */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          11. ConsentCheckbox (Unticked Default & Full Sentence Label)
        </h2>
        <Card className="space-y-4">
          <ConsentCheckbox
            id="c-calls"
            checked={consent1}
            onChange={setConsent1}
            label="I consent to receiving automated phone calls when a verified hospital nearby urgently needs my blood group."
            description="Calls are limited to your configured distance radius and pause automatically once enough donors respond."
            required
          />

          <ConsentCheckbox
            id="c-terms"
            checked={consent2}
            onChange={setConsent2}
            label="I understand that blood donation is strictly voluntary and uncompensated, and I can opt out anytime by pressing 9."
            description="Indian National Blood Transfusion Council regulations strictly prohibit remuneration."
          />

          <ConsentCheckbox
            id="c-err"
            checked={false}
            onChange={() => {}}
            label="I attest that I am at least 18 years of age and weigh at least 45 kg."
            error="You must confirm donor eligibility before submitting registration."
            required
          />
        </Card>
      </section>

      {/* 12. Keypad */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          12. Keypad (/sim Screen Telephone Keypad)
        </h2>
        <Card className="text-center">
          <p className="text-xs text-[var(--muted)] mb-4">
            Interactive phone keypad for call simulation. Click a button to simulate an IVR digit response.
          </p>
          <Keypad
            activeKey={activeKey}
            onPressKey={(k) => {
              setActiveKey(k)
              triggerToast('info', `Keypad Pressed: ${k}`, `Simulated DTMF digit ${k} transmitted.`)
            }}
          />
          <div className="mt-4 text-xs font-mono text-[var(--muted)]">
            Active simulated key: <strong className="text-[var(--text)]">{activeKey ?? 'None'}</strong>
          </div>
        </Card>
      </section>

      {/* 13. TracePanel */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          13. TracePanel (AI Extraction vs Deterministic Code Decision)
        </h2>
        <TracePanel
          trace={sampleTrace}
          rawText={sampleRawText}
          defaultOpen={true}
        />
      </section>

      {/* 14. StatTile */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          14. StatTile (44px Tabular Numerals & Comparison Baselines)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="First Donor on the Way"
            value="12m"
            baseline="Baseline: 45m (73% faster)"
            trend="positive"
          />
          <StatTile
            label="Time to Covered (N+1)"
            value="26m"
            baseline="Baseline: 90m (3.4x faster)"
            trend="positive"
          />
          <StatTile
            label="Time to Fulfilled"
            value="48m"
            baseline="Baseline: 180m (3.7x faster)"
            trend="positive"
          />
          <StatTile
            label="Stand-down Reach"
            value="98.4%"
            baseline="Zero unnotified arrivals"
            trend="positive"
          />
        </div>
      </section>

      {/* 15. Toast Notification System */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          15. Toast Notifications (Radix Toast Primitive)
        </h2>
        <Card>
          <p className="text-xs text-[var(--muted)] mb-4">
            Non-disruptive feedback toasts styled with design tokens and high-contrast variant borders.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              leftIcon={<Bell className="w-4 h-4 text-[var(--info)]" />}
              onClick={() => triggerToast('info', 'Outreach Active', 'Contacting 4 nearby donors in round 1.')}
            >
              Info Toast
            </Button>
            <Button
              variant="secondary"
              leftIcon={<CheckCircle2 className="w-4 h-4 text-[var(--success)]" />}
              onClick={() => triggerToast('success', 'Donor Accepted', 'Donor A7 medically accepted by staff.')}
            >
              Success Toast
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Bell className="w-4 h-4 text-[var(--warning)]" />}
              onClick={() => triggerToast('warning', 'Dialer Paused', 'Covered count reached target N+1.')}
            >
              Warning Toast
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Bell className="w-4 h-4 text-[var(--danger)]" />}
              onClick={() => triggerToast('danger', 'Scam Flagged', 'Message soliciting payment was rejected.')}
            >
              Danger Toast
            </Button>
          </div>
        </Card>
      </section>
    </div>
  )
}
