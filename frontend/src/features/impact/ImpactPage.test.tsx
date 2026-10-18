import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ImpactPage } from './ImpactPage'
import { LangProvider } from '../../i18n/useT'
import { ThemeProvider } from '../../lib/theme'
import { mockEngine } from '../../api/mock/engine'
import { runStory } from '../../api/mock/story'

function renderImpactPage() {
  return render(
    <MemoryRouter initialEntries={['/impact']}>
      <ThemeProvider>
        <LangProvider>
          <ImpactPage />
        </LangProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('ImpactPage (/impact)', () => {
  beforeEach(() => {
    mockEngine.reset()
  })

  it('renders simulated data label, heading, and the 3 core StatTiles with baselines', async () => {
    renderImpactPage()

    // 1. Label at top
    expect(
      await screen.findByText('Simulated data from demo runs', {}, { timeout: 4000 }),
    ).toBeInTheDocument()

    // Heading
    expect(screen.getByText('Coordination Impact')).toBeInTheDocument()

    // 2. Three core StatTile labels
    expect(screen.getByText(/Time to first donor on the way/i)).toBeInTheDocument()
    expect(screen.getByText(/Time to covered/i)).toBeInTheDocument()
    expect(screen.getByText(/Time to fulfilled/i)).toBeInTheDocument()

    // 3. Baselines with Assumed baseline label
    expect(screen.getByText(/45m/i)).toBeInTheDocument()
    expect(screen.getByText(/90m/i)).toBeInTheDocument()
    expect(screen.getByText(/180m/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Assumed baseline · simulated run/i).length).toBe(3)

    // Honesty disclaimer line
    expect(
      screen.getByText(
        'Donors, hospitals and patients are simulated. Gemini, the Desk checks and the phone calls are real.',
      ),
    ).toBeInTheDocument()

    // 4. Secondary metrics
    expect(screen.getByText(/Calls per accepted donor/i)).toBeInTheDocument()
    expect(screen.getByText(/Stand-down reach/i)).toBeInTheDocument()
  })

  it('computes non-zero metrics after running the demo story', async () => {
    // Run the story without delay so timeline events are generated
    await act(async () => {
      await runStory({ engine: mockEngine, stepDelayMs: 0 })
    })

    renderImpactPage()

    // Ensure metrics loaded
    expect(
      await screen.findByText('Simulated data from demo runs', {}, { timeout: 4000 }),
    ).toBeInTheDocument()

    // Time to first donor on the way should be non-zero (e.g. 3m)
    const metrics = await mockEngine.getMetrics()
    expect(metrics.medianMinutesToFirstOnTheWay).toBeGreaterThan(0)
    expect(metrics.medianMinutesToCovered).toBeGreaterThan(0)
    expect(metrics.medianMinutesToFulfilled).toBeGreaterThan(0)
    expect(metrics.callsPerAccepted).toBeGreaterThan(0)
    expect(metrics.standDownReachPct).toBe(100)

    // Verify rendered on page
    expect(await screen.findByText(`${metrics.medianMinutesToFirstOnTheWay}m`)).toBeInTheDocument()
    expect(screen.getByText(`${metrics.medianMinutesToCovered}m`)).toBeInTheDocument()
    expect(screen.getByText(`${metrics.medianMinutesToFulfilled}m`)).toBeInTheDocument()
    expect(screen.getByText(`${metrics.callsPerAccepted}`)).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
