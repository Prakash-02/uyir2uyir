import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { useT } from '../../i18n/useT'
import {
  Heart,
  ShieldCheck,
  Clock,
  Building2,
  HeartHandshake,
  FileCheck2,
  UserPlus,
  ArrowRight,
} from 'lucide-react'

export function LandingPage() {
  const { t, lang } = useT()

  return (
    <div className="space-y-12 sm:space-y-16 py-4 sm:py-8">
      {/* 1. Hero Section */}
      <section className="text-center max-w-4xl mx-auto px-4 space-y-6">
        <div className="flex justify-center items-center">
          <Logo size="lg" />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--text)] font-heading">
            {lang === 'ta' ? 'உயிர்2உயிர்' : 'Uyir2Uyir'}
          </h1>
          <p className="text-xl sm:text-2xl font-bold text-[var(--primary)] tracking-wide">
            {t.tagline}
          </p>
        </div>

        <p className="text-base sm:text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
          {t.summary}
        </p>

        <p className="text-xs sm:text-sm font-semibold text-[var(--primary)] max-w-xl mx-auto py-1 px-3 rounded-full bg-[var(--danger-tint)]/40 border border-[var(--primary)]/20">
          {t.honestyDisclaimer}
        </p>

        {/* Quick Demo CTA */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/desk"
            className="min-h-[48px] px-6 py-2.5 rounded-md bg-[var(--primary)] text-[var(--primary-on)] font-bold text-sm sm:text-base shadow-sm hover:opacity-90 transition-opacity inline-flex items-center gap-2 focus-visible:outline-3 focus-visible:outline-[var(--info)]"
          >
            <FileCheck2 className="w-5 h-5" aria-hidden="true" />
            <span>{t.roles.desk.action}</span>
          </Link>
          <Link
            to="/join"
            className="min-h-[48px] px-6 py-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-bold text-sm sm:text-base hover:bg-[var(--border)]/20 transition-colors inline-flex items-center gap-2 focus-visible:outline-3 focus-visible:outline-[var(--info)]"
          >
            <UserPlus className="w-5 h-5 text-[var(--primary)]" aria-hidden="true" />
            <span>{t.roles.join.action}</span>
          </Link>
        </div>
      </section>

      {/* 2. Three Promises Section */}
      <section
        aria-labelledby="promises-heading"
        className="max-w-6xl mx-auto px-4 space-y-6"
      >
        <div className="text-center">
          <h2
            id="promises-heading"
            className="text-2xl sm:text-3xl font-bold text-[var(--text)] font-heading"
          >
            {t.promises.sectionTitle}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Promise 1: Freely */}
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs hover:border-[var(--primary)]/40 transition-colors flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-[var(--danger-tint)] text-[var(--primary)] flex items-center justify-center">
                <Heart className="w-6 h-6 fill-current" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text)] font-heading">
                {t.promises.freely.title}
              </h3>
              <p className="text-sm font-semibold text-[var(--primary)]">
                {t.promises.freely.tagline}
              </p>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                {t.promises.freely.desc}
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--border)]/60 text-xs italic text-[var(--muted)]">
              &ldquo;{t.footer.mandatory}&rdquo;
            </div>
          </div>

          {/* Promise 2: Safely */}
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs hover:border-[var(--success)]/40 transition-colors flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-[var(--success-tint)] text-[var(--success)] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text)] font-heading">
                {t.promises.safely.title}
              </h3>
              <p className="text-sm font-semibold text-[var(--success)]">
                {t.promises.safely.tagline}
              </p>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                {t.promises.safely.desc}
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--border)]/60 text-xs text-[var(--muted)]">
              {t.promises.safely.footer}
            </div>
          </div>

          {/* Promise 3: In time */}
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs hover:border-[var(--info)]/40 transition-colors flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-[var(--info-tint)] text-[var(--info)] flex items-center justify-center">
                <Clock className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text)] font-heading">
                {t.promises.inTime.title}
              </h3>
              <p className="text-sm font-semibold text-[var(--info)]">
                {t.promises.inTime.tagline}
              </p>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                {t.promises.inTime.desc}
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--border)]/60 text-xs text-[var(--muted)]">
              {t.promises.inTime.footer}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Role Cards Section */}
      <section
        aria-labelledby="roles-heading"
        className="max-w-6xl mx-auto px-4 space-y-6"
      >
        <div className="text-center space-y-2">
          <h2
            id="roles-heading"
            className="text-2xl sm:text-3xl font-bold text-[var(--text)] font-heading"
          >
            {t.roles.sectionTitle}
          </h2>
          <p className="text-sm text-[var(--muted)] max-w-xl mx-auto">
            {t.roles.sectionSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Role 1: Hospital */}
          <Link
            to="/hospital"
            className="group p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs hover:border-[var(--primary)] hover:shadow-md transition-all flex flex-col justify-between focus-visible:outline-3 focus-visible:outline-[var(--info)]"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--danger-tint)] text-[var(--primary)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text)] font-heading group-hover:text-[var(--primary)] transition-colors">
                {t.roles.hospital.title}
              </h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t.roles.hospital.desc}
              </p>
            </div>
            <div className="pt-4 flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]">
              <span>{t.roles.hospital.action}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </div>
          </Link>

          {/* Role 2: Blood Centre */}
          <Link
            to="/centre"
            className="group p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs hover:border-[var(--primary)] hover:shadow-md transition-all flex flex-col justify-between focus-visible:outline-3 focus-visible:outline-[var(--info)]"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--info-tint)] text-[var(--info)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <HeartHandshake className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text)] font-heading group-hover:text-[var(--primary)] transition-colors">
                {t.roles.centre.title}
              </h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t.roles.centre.desc}
              </p>
            </div>
            <div className="pt-4 flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]">
              <span>{t.roles.centre.action}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </div>
          </Link>

          {/* Role 3: Public Request Desk */}
          <Link
            to="/desk"
            className="group p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs hover:border-[var(--primary)] hover:shadow-md transition-all flex flex-col justify-between focus-visible:outline-3 focus-visible:outline-[var(--info)]"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--success-tint)] text-[var(--success)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileCheck2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text)] font-heading group-hover:text-[var(--primary)] transition-colors">
                {t.roles.desk.title}
              </h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t.roles.desk.desc}
              </p>
            </div>
            <div className="pt-4 flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]">
              <span>{t.roles.desk.action}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </div>
          </Link>

          {/* Role 4: Join as Donor */}
          <Link
            to="/join"
            className="group p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs hover:border-[var(--primary)] hover:shadow-md transition-all flex flex-col justify-between focus-visible:outline-3 focus-visible:outline-[var(--info)]"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--warning-tint)] text-[var(--warning)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <UserPlus className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text)] font-heading group-hover:text-[var(--primary)] transition-colors">
                {t.roles.join.title}
              </h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t.roles.join.desc}
              </p>
            </div>
            <div className="pt-4 flex items-center gap-1.5 text-xs font-bold text-[var(--primary)]">
              <span>{t.roles.join.action}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </div>
          </Link>
        </div>
      </section>

      {/* 4. How It Works Strip (4 Steps) */}
      <section
        aria-labelledby="how-it-works-heading"
        className="max-w-6xl mx-auto px-4"
      >
        <div className="p-6 sm:p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs space-y-6">
          <div className="text-center space-y-1">
            <h2
              id="how-it-works-heading"
              className="text-2xl sm:text-3xl font-bold text-[var(--text)] font-heading"
            >
              {t.howItWorks.sectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--muted)]">
              {t.howItWorks.sectionSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Step 1 */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {t.howItWorks.step1.number}
                </div>
                <h3 className="font-bold text-base text-[var(--text)] font-heading">
                  {t.howItWorks.step1.title}
                </h3>
              </div>
              <p className="text-xs text-[var(--muted)] pl-11 leading-relaxed">
                {t.howItWorks.step1.desc}
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {t.howItWorks.step2.number}
                </div>
                <h3 className="font-bold text-base text-[var(--text)] font-heading">
                  {t.howItWorks.step2.title}
                </h3>
              </div>
              <p className="text-xs text-[var(--muted)] pl-11 leading-relaxed">
                {t.howItWorks.step2.desc}
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {t.howItWorks.step3.number}
                </div>
                <h3 className="font-bold text-base text-[var(--text)] font-heading">
                  {t.howItWorks.step3.title}
                </h3>
              </div>
              <p className="text-xs text-[var(--muted)] pl-11 leading-relaxed">
                {t.howItWorks.step3.desc}
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--success)] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {t.howItWorks.step4.number}
                </div>
                <h3 className="font-bold text-base text-[var(--text)] font-heading">
                  {t.howItWorks.step4.title}
                </h3>
              </div>
              <p className="text-xs text-[var(--muted)] pl-11 leading-relaxed">
                {t.howItWorks.step4.desc}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
