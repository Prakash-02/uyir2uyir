import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EvalPage } from './EvalPage'
import { LangProvider } from '../../i18n/useT'
import { ThemeProvider } from '../../lib/theme'
import { mockEngine } from '../../api/mock/engine'

function renderEvalPage() {
  return render(
    <MemoryRouter initialEntries={['/eval']}>
      <ThemeProvider>
        <LangProvider>
          <EvalPage />
        </LangProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('EvalPage (/eval)', () => {
  beforeEach(() => {
    mockEngine.reset()
  })

  it('renders sample run badge, summary tiles, and evaluation table', async () => {
    renderEvalPage()

    // 1. Sample badge
    expect(
      await screen.findByText('Sample: replaced by the real backend eval run', {}, { timeout: 4000 }),
    ).toBeInTheDocument()

    // Title
    expect(screen.getByText('AI Verification Benchmarks')).toBeInTheDocument()

    // 2. Summary tiles
    expect(screen.getByText('Total evaluated')).toBeInTheDocument()
    expect(screen.getByText('Accuracy')).toBeInTheDocument()
    expect(screen.getByText('Payment to hospital')).toBeInTheDocument()
    expect(screen.getByText('Wrong hospital IDs')).toBeInTheDocument()
    expect(screen.getByText('p95 latency')).toBeInTheDocument()

    // Zero targets
    expect(screen.getByText(/Target: 0 \(Mandatory\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Target: 0 \(Strict catalog\)/i)).toBeInTheDocument()

    // 3. Evaluation table
    expect(screen.getByText('Test Case Results')).toBeInTheDocument()
    expect(screen.getByText('msg-01')).toBeInTheDocument()
    expect(screen.getByText('msg-05')).toBeInTheDocument()

    // Status badges
    const passBadges = screen.getAllByText('PASS')
    expect(passBadges.length).toBeGreaterThan(0)
  })

  it('renders "No evaluation run published yet" when getLatestEval returns null / rejects', async () => {
    const { getApi } = await import('../../api/client')
    const api = getApi()
    const spy = vi.spyOn(api, 'getLatestEval').mockRejectedValueOnce(new Error('404 Not Found'))

    renderEvalPage()

    expect(await screen.findByText('No evaluation run published yet')).toBeInTheDocument()
    spy.mockRestore()
  })
})
