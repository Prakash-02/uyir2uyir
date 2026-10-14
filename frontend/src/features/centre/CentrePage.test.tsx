import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { CentrePage } from './CentrePage'
import { LangProvider } from '../../i18n/useT'
import { ThemeProvider } from '../../lib/theme'
import { mockEngine } from '../../api/mock/engine'

function renderCentrePage() {
  return render(
    <ThemeProvider>
      <LangProvider>
        <CentrePage />
      </LangProvider>
    </ThemeProvider>,
  )
}

describe('CentrePage (/centre)', () => {
  beforeEach(() => {
    window.innerWidth = 1200
    mockEngine.reset()
  })

  it('renders the header with "Sample Blood Centre (demo)"', async () => {
    renderCentrePage()
    expect(await screen.findByRole('heading', { name: /Sample Blood Centre \(demo\)/i })).toBeInTheDocument()
    expect(screen.getByText(/Signed in as staff/i)).toBeInTheDocument()
  })

  it('toggles the weather alert switch and displays the rain warning note', async () => {
    renderCentrePage()

    const weatherSwitch = screen.getByRole('switch', { name: /Toggle IMD orange alert/i })
    expect(weatherSwitch).toBeInTheDocument()
    expect(weatherSwitch).toHaveAttribute('aria-checked', 'false')

    // Click switch to toggle ON
    await act(async () => {
      fireEvent.click(weatherSwitch)
    })

    // Info note appears
    expect(
      await screen.findByText(
        /Calls now include: If roads near you are unsafe because of rain, please press 2\./i,
      ),
    ).toBeInTheDocument()
    expect(weatherSwitch).toHaveAttribute('aria-checked', 'true')

    // Click again to toggle OFF
    await act(async () => {
      fireEvent.click(weatherSwitch)
    })

    await waitFor(() => {
      expect(
        screen.queryByText(
          /Calls now include: If roads near you are unsafe because of rain, please press 2\./i,
        ),
      ).not.toBeInTheDocument()
    })
  })

  it('displays active requests and selects one', async () => {
    renderCentrePage()

    // Default request req-demo-1 is seeded
    expect(await screen.findByText(/IP-101/i)).toBeInTheDocument()
    const requestCard = screen.getByRole('button', { name: /Select O\+ RED_CELLS request/i })
    expect(requestCard).toBeInTheDocument()
    expect(requestCard).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows Round 1 text and ProgressBanner with covered vs N+1 and accepted vs N', async () => {
    renderCentrePage()

    // Shows "Round 1"
    expect(await screen.findByText(/^Round 1$/)).toBeInTheDocument()

    // Shows ProgressBanner and coverage text
    expect(screen.getByText(/covered \(target N\+1\)/i)).toBeInTheDocument()
    expect(screen.getByText(/accepted \(target N\)/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Accept only after your own screening\. U2U never decides eligibility\./i),
    ).toBeInTheDocument()
  })

  it('three press 1s lead to PAUSED, and accepting two donors leads to FULFILLED', async () => {
    renderCentrePage()

    // Wait for initial render of Round 1
    expect(await screen.findByText(/^Round 1$/)).toBeInTheDocument()

    // 1. In mockEngine, Round 1 dispatched 5 calls for req-demo-1
    const calls = mockEngine.getAllCalls().filter((c) => c.requestId === 'req-demo-1' && c.round === 1)
    expect(calls.length).toBe(5)

    // Three donors press 1 -> covered reaches 3 (N+1 where N=2) -> PAUSED!
    await act(async () => {
      await mockEngine.simPressKey(calls[0].id, '1')
      await mockEngine.simPressKey(calls[1].id, '1')
      await mockEngine.simPressKey(calls[2].id, '1')
    })

    // Verify warning note appears when PAUSED
    expect(
      await screen.findByText(
        /Enough donors on the way\. Calling paused\. U2U will call again if someone drops out\./i,
      ),
    ).toBeInTheDocument()

    // Status badges show "Enough on the way" (PAUSED)
    const pausedBadges = screen.getAllByText(/Enough on the way/i)
    expect(pausedBadges.length).toBeGreaterThan(0)

    // Call rows for ON_THE_WAY donors show Accept and Defer buttons
    const acceptButtons = screen.getAllByRole('button', { name: /Accept donation from/i })
    expect(acceptButtons.length).toBeGreaterThanOrEqual(3)

    const deferButtons = screen.getAllByRole('button', { name: /Defer Donor/i })
    expect(deferButtons.length).toBeGreaterThanOrEqual(3)

    // 2. Staff accepts first donor -> accepted = 1
    await act(async () => {
      fireEvent.click(acceptButtons[0])
    })

    await waitFor(() => {
      expect(mockEngine.getRequest('req-demo-1')?.accepted).toBe(1)
    })

    // Staff accepts second donor -> accepted = 2 (N) -> FULFILLED!
    const updatedAcceptButtons = await screen.findAllByRole('button', { name: /Accept donation from/i })
    await act(async () => {
      fireEvent.click(updatedAcceptButtons[0])
    })

    // Verify request status reaches FULFILLED
    await waitFor(() => {
      expect(mockEngine.getRequest('req-demo-1')?.status).toBe('FULFILLED')
    })

    expect(
      await screen.findByText(/Target of 2 units clinically accepted\. Request Fulfilled\./i),
    ).toBeInTheDocument()
    const fulfilledBadges = screen.getAllByText(/Fulfilled/i)
    expect(fulfilledBadges.length).toBeGreaterThan(0)
  })

  it('deferring an ON_THE_WAY donor opens a dialog with optional return date and updates call', async () => {
    renderCentrePage()

    // Make donor 0 ON_THE_WAY
    const calls = mockEngine.getAllCalls().filter((c) => c.requestId === 'req-demo-1')
    await act(async () => {
      await mockEngine.simPressKey(calls[0].id, '1')
    })

    // Defer button should appear for donor 0
    const deferBtn = await screen.findByRole('button', { name: `Defer ${calls[0].donorAlias}` })
    await act(async () => {
      fireEvent.click(deferBtn)
    })

    // Dialog opens with title and optional return date input
    expect(await screen.findByRole('heading', { name: `Defer Donor ${calls[0].donorAlias}` })).toBeInTheDocument()
    expect(screen.getByLabelText(/Optional return date/i)).toBeInTheDocument()

    // Enter optional return date
    const dateInput = screen.getByLabelText(/Optional return date/i)
    fireEvent.change(dateInput, { target: { value: '2026-11-20' } })

    // Confirm deferral
    const confirmBtn = screen.getByRole('button', { name: /Confirm deferral/i })
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    // Check that engine received the deferral with return date
    await waitFor(() => {
      expect(mockEngine.getCall(calls[0].id)?.state).toBe('DEFERRED')
    })

    expect(await screen.findByText('Deferred')).toBeInTheDocument()
  })

  it('never displays donor phone numbers on screen', async () => {
    renderCentrePage()

    // Ensure donor aliases appear but no phone numbers
    expect(await screen.findByText(/^Donor A1$/)).toBeInTheDocument()

    // Regex checking for phone numbers like 9876543210, +91, etc.
    const phonePattern = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/
    const allText = document.body.textContent || ''
    expect(phonePattern.test(allText)).toBe(false)
  })

  it('uses aria-live="polite" on live counters and status elements', async () => {
    renderCentrePage()
    await screen.findByRole('heading', { name: /Sample Blood Centre \(demo\)/i })
    const politeElements = document.querySelectorAll('[aria-live="polite"]')
    expect(politeElements.length).toBeGreaterThan(0)
  })

  it('switches between calls and timeline tabs on mobile view', async () => {
    window.innerWidth = 500
    renderCentrePage()

    // Find tab triggers
    const timelineTab = screen.getByRole('tab', { name: /Live Timeline/i })
    expect(timelineTab).toBeInTheDocument()

    await act(async () => {
      fireEvent.keyDown(timelineTab, { key: 'Enter' })
    })

    await waitFor(() => {
      expect(timelineTab).toHaveAttribute('data-state', 'active')
    })
  })
})
