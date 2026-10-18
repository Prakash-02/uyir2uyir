import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SimPage } from './SimPage'
import { LangProvider } from '../../i18n/useT'
import { ThemeProvider } from '../../lib/theme'
import { mockEngine } from '../../api/mock/engine'

function renderSimPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LangProvider>
          <SimPage />
        </LangProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('SimPage (/sim)', () => {
  beforeEach(() => {
    window.innerWidth = 1200
    mockEngine.reset()
  })

  it('renders top note: "Demo simulator. In the live system this is a real phone call."', async () => {
    renderSimPage()
    expect(
      await screen.findByText(/Demo simulator\. In the live system this is a real phone call\./i),
    ).toBeInTheDocument()
  })

  it('shows empty state hint when there are no ringing calls', async () => {
    // Decline all currently ringing calls to create empty state
    const ringingCalls = mockEngine.getAllCalls().filter((c) => c.state === 'RINGING')
    for (const call of ringingCalls) {
      await mockEngine.simPressKey(call.id, '2')
    }

    renderSimPage()
    expect(
      await screen.findByText(/Raise a request on the Hospital screen, or press Run the story\./i),
    ).toBeInTheDocument()
    expect(screen.getByText(/No active ringing calls/i)).toBeInTheDocument()
  })

  it('renders active ringing call, phone handset frame, and call script in English', async () => {
    renderSimPage()

    // Should display ringing call for Donor A1
    const donorA1Elements = await screen.findAllByText('Donor A1')
    expect(donorA1Elements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/U2U VOICE DISPATCH/i)).toBeInTheDocument()

    // Check call script text for default seeded request
    expect(screen.getByText(/needs O\+ RED_CELLS/i)).toBeInTheDocument()
    expect(screen.getByText(/Press 1 if you can come/i)).toBeInTheDocument()

    // Keypad keys should be present
    expect(screen.getByRole('button', { name: /Digit 1: I'm coming/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Digit 2: I can't/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Digit 9: Stop calling me/i })).toBeInTheDocument()
  })

  it('includes the rain advisory in call script when weather alert is ON', async () => {
    await mockEngine.setWeatherAlert(true)

    renderSimPage()

    // Script should include the rain advisory line
    const rainLine = 'If roads near you are unsafe because of rain, please press 2.'
    expect(await screen.findByText(new RegExp(rainLine, 'i'))).toBeInTheDocument()
  })

  it('handles pressing 1: displays "Thank you. Please go to {centreName}." and map link', async () => {
    renderSimPage()

    const key1Btn = await screen.findByRole('button', { name: /Digit 1: I'm coming/i })

    await act(async () => {
      fireEvent.click(key1Btn)
    })

    // Response screen after pressing 1
    expect(
      await screen.findByText(/Thank you\. Please go to Central Blood Bank, Egmore \(Simulated\)\./i),
    ).toBeInTheDocument()

    // Map link placeholder
    const mapLink = screen.getByRole('link', { name: /Google Maps/i })
    expect(mapLink).toBeInTheDocument()
    expect(mapLink).toHaveAttribute('href', expect.stringContaining('google.com/maps'))
  })

  it('handles pressing 2: displays "Thank you for telling us."', async () => {
    renderSimPage()

    const key2Btn = await screen.findByRole('button', { name: /Digit 2: I can't/i })

    await act(async () => {
      fireEvent.click(key2Btn)
    })

    expect(await screen.findByText('Thank you for telling us.')).toBeInTheDocument()
  })

  it('handles pressing 9: displays "You won\'t be called again."', async () => {
    renderSimPage()

    const key9Btn = await screen.findByRole('button', { name: /Digit 9: Stop calling me/i })

    await act(async () => {
      fireEvent.click(key9Btn)
    })

    expect(await screen.findByText("You won't be called again.")).toBeInTheDocument()
  })

  it('handles LATE_ACCEPT: displays "Thank you, we already have enough donors."', async () => {
    // req-demo-1 needs 2 units, covered threshold = 2 + 1 = 3.
    const calls = mockEngine.getAllCalls().filter((c) => c.state === 'RINGING')
    // Have 3 donors accept first to pause the request (covered = 3 >= 3)
    await mockEngine.simPressKey(calls[0].id, '1')
    await mockEngine.simPressKey(calls[1].id, '1')
    await mockEngine.simPressKey(calls[2].id, '1')

    renderSimPage()

    // Calls 3 & 4 are still ringing; click key 1 for the selected ringing call
    const key1Btn = await screen.findByRole('button', { name: /Digit 1: I'm coming/i })

    await act(async () => {
      fireEvent.click(key1Btn)
    })

    // Should show LATE_ACCEPT response
    expect(
      await screen.findByText('Thank you, we already have enough donors.'),
    ).toBeInTheDocument()
  })

  it('allows clicking "Answer another ringing call" to reset response screen', async () => {
    renderSimPage()

    const key2Btn = await screen.findByRole('button', { name: /Digit 2: I can't/i })
    await act(async () => {
      fireEvent.click(key2Btn)
    })

    expect(await screen.findByText('Thank you for telling us.')).toBeInTheDocument()

    // Click "Answer another ringing call" button
    const answerAnotherBtn = screen.getByRole('button', { name: /Answer another ringing call/i })
    await act(async () => {
      fireEvent.click(answerAnotherBtn)
    })

    // Response screen should be reset
    await waitFor(() => {
      expect(screen.queryByText('Thank you for telling us.')).not.toBeInTheDocument()
    })
  })

  it('hides the Live button and displays "Live call needs the real backend" in mock mode', async () => {
    renderSimPage()

    // In default mock mode, Live button should NOT be rendered
    expect(screen.queryByRole('button', { name: /Answer with your voice \(Gemini Live\)/i })).not.toBeInTheDocument()

    // Explanation pill should be present
    expect(await screen.findByText(/Live call needs the real backend/i)).toBeInTheDocument()
  })

  it('ensures the keypad stays rendered and accessible during an active call', async () => {
    renderSimPage()

    // Keypad digits 1, 2, and 9 must be present and visible
    expect(await screen.findByRole('button', { name: /Digit 1: I'm coming/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Digit 2: I can't/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Digit 9: Stop calling me/i })).toBeInTheDocument()
  })
})
