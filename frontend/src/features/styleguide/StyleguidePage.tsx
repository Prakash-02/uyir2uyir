import { useState } from 'react'
import { Logo } from '../../components/Logo'
import { Button } from '../../components/Button'
import { Card, CardHeader } from '../../components/Card'
import { StatusBadge } from '../../components/StatusBadge'
import { DemoBanner } from '../../components/DemoBanner'
import { LangToggle } from '../../components/LangToggle'
import { ThemeToggle } from '../../components/ThemeToggle'
import type { RequestStatus, CallState } from '../../api/types'
import type { DeskAnswer } from '../../components/StatusBadge'
import { Plus, ArrowRight, Heart } from 'lucide-react'

export function StyleguidePage() {
  const [btnLoading, setBtnLoading] = useState(false)

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
    { name: '--bg', label: 'Background', bg: 'bg-[var(--bg)]', text: 'text-[var(--text)]' },
    { name: '--surface', label: 'Surface', bg: 'bg-[var(--surface)]', text: 'text-[var(--text)]' },
    { name: '--text', label: 'Primary Text', bg: 'bg-[var(--text)]', text: 'text-[var(--bg)]' },
    { name: '--muted', label: 'Muted Text', bg: 'bg-[var(--muted)]', text: 'text-white' },
    { name: '--border', label: 'Border', bg: 'bg-[var(--border)]', text: 'text-[var(--text)]' },
    { name: '--primary', label: 'Crimson Primary', bg: 'bg-[var(--primary)]', text: 'text-[var(--primary-on)]' },
    { name: '--success', label: 'Success', bg: 'bg-[var(--success)]', text: 'text-white' },
    { name: '--success-tint', label: 'Success Tint', bg: 'bg-[var(--success-tint)]', text: 'text-[var(--success)]' },
    { name: '--warning', label: 'Warning', bg: 'bg-[var(--warning)]', text: 'text-white' },
    { name: '--warning-tint', label: 'Warning Tint', bg: 'bg-[var(--warning-tint)]', text: 'text-[var(--warning)]' },
    { name: '--danger', label: 'Danger', bg: 'bg-[var(--danger)]', text: 'text-white' },
    { name: '--danger-tint', label: 'Danger Tint', bg: 'bg-[var(--danger-tint)]', text: 'text-[var(--danger)]' },
    { name: '--info', label: 'Info', bg: 'bg-[var(--info)]', text: 'text-white' },
    { name: '--info-tint', label: 'Info Tint', bg: 'bg-[var(--info-tint)]', text: 'text-[var(--info)]' },
    { name: '--demo', label: 'Demo Banner', bg: 'bg-[var(--demo)]', text: 'text-[#1C1917]' },
  ]

  return (
    <div className="space-y-12 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold font-heading text-[var(--text)]">
          U2U Design System Styleguide
        </h1>
        <p className="text-base text-[var(--muted)] mt-2">
          Design foundation: tokens, typography, colors, logo, and core accessible UI components.
        </p>
      </div>

      {/* 1. Brand Logo */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          1. Brand Logo & Mark
        </h2>
        <Card>
          <div className="flex flex-wrap items-center gap-8">
            <div className="space-y-1">
              <span className="text-xs text-[var(--muted)] block">Small</span>
              <Logo size="sm" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-[var(--muted)] block">Medium (Standard)</span>
              <Logo size="md" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-[var(--muted)] block">Large (Hero)</span>
              <Logo size="lg" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-[var(--muted)] block">Mark Only</span>
              <Logo size="lg" showWordmark={false} />
            </div>
          </div>
        </Card>
      </section>

      {/* 2. Color Palette */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          2. Color Tokens
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {colorSwatches.map(({ name, label, bg, text }) => (
            <div
              key={name}
              className={`p-4 rounded-lg border border-[var(--border)] ${bg} ${text} shadow-xs flex flex-col justify-between h-24`}
            >
              <span className="font-mono text-xs font-semibold">{name}</span>
              <span className="text-xs font-medium opacity-90">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Typography */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          3. Typography & Scripts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="English (Noto Sans & Anek Tamil)" subtitle="Tabular numerals & heading hierarchy" />
            <div className="space-y-3">
              <h1 className="text-2xl font-bold">H1 Heading (30px)</h1>
              <h2 className="text-xl font-semibold">H2 Section Heading (24px)</h2>
              <h3 className="text-lg font-medium">H3 Subsection (20px)</h3>
              <p className="text-base text-[var(--text)]">
                Body text (16px, line-height 1.5): Relaying urgent blood requests from verified hospitals to nearby consented donors.
              </p>
              <div className="text-3xl font-bold font-heading text-[var(--primary)] tnum">
                Hero Numbers: 44 · 12:45 · 98.6%
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Tamil (Noto Sans Tamil & Anek Tamil)" subtitle="17px body with 1.6 line-height" />
            <div className="space-y-3" lang="ta">
              <h1 className="text-2xl font-bold">உயிர்2உயிர் தலைப்பு (30px)</h1>
              <h2 className="text-xl font-semibold">இரத்ததான ஒருங்கிணைப்பு (24px)</h2>
              <p className="text-[17px] leading-[1.6] text-[var(--text)]">
                அவசர இரத்தத் தேவைகளுக்கான தொலைபேசி அழைப்பு சேவை. உயிர் தொடர்கிறது. இலவசமாக. பாதுகாப்பாக. நேரத்தில்.
              </p>
              <div className="text-sm text-[var(--muted)]">
                (Note: Never all-caps for Tamil text)
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 4. Button Component */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
          <h2 className="text-xl font-bold font-heading text-[var(--text)]">
            4. Button (48px Touch Target)
          </h2>
          <Button
            variant="ghost"
            onClick={() => setBtnLoading(!btnLoading)}
            className="text-xs min-h-[36px]"
          >
            Toggle Loading State
          </Button>
        </div>

        <Card>
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-3">
                Variants
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" isLoading={btnLoading}>
                  Primary Action
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
                With Icons
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
                States
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" isLoading>
                  Saving
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

        <div className="space-y-6">
          <Card>
            <CardHeader title="Request Statuses" subtitle="All 7 BloodRequest lifecycle states" />
            <div className="flex flex-wrap items-center gap-2.5">
              {requestStatuses.map((st) => (
                <StatusBadge key={st} status={st} />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Call States" subtitle="All 12 IVR donor call states" />
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

      {/* 6. DemoBanner Component */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          6. DemoBanner
        </h2>
        <Card className="p-0 overflow-hidden">
          <DemoBanner />
          <div className="p-4 bg-[var(--surface)] text-xs text-[var(--muted)]">
            Persistent top bar in demo mode with <code>role=&quot;status&quot;</code> and high-visibility contrast.
          </div>
        </Card>
      </section>

      {/* 7. Controls & Theme Switchers */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-heading text-[var(--text)] border-b border-[var(--border)] pb-2">
          7. Interactive Shell Controls
        </h2>
        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-2">
              <span className="text-xs text-[var(--muted)] block">Language Toggle (EN / த)</span>
              <LangToggle />
            </div>
            <div className="space-y-2">
              <span className="text-xs text-[var(--muted)] block">Theme Toggle (Light / Dark)</span>
              <ThemeToggle />
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}
