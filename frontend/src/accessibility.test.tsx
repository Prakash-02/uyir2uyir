import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import axe from 'axe-core'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import { LangProvider } from './i18n/useT'
import { ToastProvider } from './components/Toast'
import { AppShell } from './components/AppShell'
import { AppRoutes } from './routes'

// Helper to render any route with all necessary application providers
function renderRoute(route: string) {
  return render(
    <ThemeProvider>
      <LangProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </MemoryRouter>
        </ToastProvider>
      </LangProvider>
    </ThemeProvider>,
  )
}

// Axe runner for container: in jsdom, layout-dependent rules like color-contrast are skipped
async function checkA11y(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false }, // jsdom does not support visual font/box geometry
    },
  })
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  return seriousOrCritical
}

describe('Accessibility audit with axe-core across all routes', () => {
  it('passes axe audit on / (Landing)', async () => {
    const { container } = renderRoute('/')
    await screen.findByRole('heading', { name: /Uyir2Uyir/i, level: 1 })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /hospital', async () => {
    const { container } = renderRoute('/hospital')
    await screen.findByRole('heading', { name: /Hospital Request/i })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /centre', async () => {
    const { container } = renderRoute('/centre')
    await screen.findByRole('heading', { name: /Sample Blood Centre/i })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /desk', async () => {
    const { container } = renderRoute('/desk')
    await screen.findByRole('heading', { name: /Public Request Desk/i })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /confirm/:token', async () => {
    const { container } = renderRoute('/confirm/demo-confirm-tok-123')
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /join', async () => {
    const { container } = renderRoute('/join')
    await screen.findByRole('heading', { name: /Join U2U Donor Network/i })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /sim', async () => {
    const { container } = renderRoute('/sim')
    await screen.findByRole('heading', { name: /Call Simulator/i })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /impact', async () => {
    const { container } = renderRoute('/impact')
    await screen.findByRole('heading', { name: /Live Impact Dashboard/i })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /eval', async () => {
    const { container } = renderRoute('/eval')
    await screen.findByRole('heading', { name: /Verification Evaluation Suite/i })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /styleguide', async () => {
    const { container } = renderRoute('/styleguide')
    await screen.findByRole('heading', { name: /U2U Design System & Component Styleguide/i })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })

  it('passes axe audit on /not-found', async () => {
    const { container } = renderRoute('/404-nonexistent-route')
    await screen.findByRole('heading', { name: /Page not found/i })
    const violations = await checkA11y(container)
    expect(violations).toEqual([])
  })
})
