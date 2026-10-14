import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'

const LandingPage = lazy(() =>
  import('./features/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const HospitalPage = lazy(() =>
  import('./features/hospital/HospitalPage').then((m) => ({ default: m.HospitalPage })),
)
const CentrePage = lazy(() =>
  import('./features/centre/CentrePage').then((m) => ({ default: m.CentrePage })),
)
const DeskPage = lazy(() =>
  import('./features/desk/DeskPage').then((m) => ({ default: m.DeskPage })),
)
const ConfirmPage = lazy(() =>
  import('./features/confirm/ConfirmPage').then((m) => ({ default: m.ConfirmPage })),
)
const JoinPage = lazy(() =>
  import('./features/join/JoinPage').then((m) => ({ default: m.JoinPage })),
)
const SimPage = lazy(() =>
  import('./features/sim/SimPage').then((m) => ({ default: m.SimPage })),
)
const ImpactPage = lazy(() =>
  import('./features/impact/ImpactPage').then((m) => ({ default: m.ImpactPage })),
)
const EvalPage = lazy(() =>
  import('./features/eval/EvalPage').then((m) => ({ default: m.EvalPage })),
)
const StyleguidePage = lazy(() =>
  import('./features/styleguide/StyleguidePage').then((m) => ({ default: m.StyleguidePage })),
)
const NotFoundPage = lazy(() =>
  import('./features/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="p-12 text-center text-[var(--muted)] text-sm animate-pulse max-w-lg mx-auto"
    >
      Loading…
    </div>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/hospital" element={<HospitalPage />} />
        <Route path="/centre" element={<CentrePage />} />
        <Route path="/desk" element={<DeskPage />} />
        <Route path="/confirm/:token" element={<ConfirmPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/sim" element={<SimPage />} />
        <Route path="/impact" element={<ImpactPage />} />
        <Route path="/eval" element={<EvalPage />} />
        <Route path="/styleguide" element={<StyleguidePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
