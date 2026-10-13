import { Routes, Route } from 'react-router-dom'
import { LandingPage } from './features/landing/LandingPage'
import { HospitalPage } from './features/hospital/HospitalPage'
import { CentrePage } from './features/centre/CentrePage'
import { DeskPage } from './features/desk/DeskPage'
import { ConfirmPage } from './features/confirm/ConfirmPage'
import { JoinPage } from './features/join/JoinPage'
import { SimPage } from './features/sim/SimPage'
import { ImpactPage } from './features/impact/ImpactPage'
import { EvalPage } from './features/eval/EvalPage'
import { StyleguidePage } from './features/styleguide/StyleguidePage'
import { NotFoundPage } from './features/NotFoundPage'

export function AppRoutes() {
  return (
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
  )
}
