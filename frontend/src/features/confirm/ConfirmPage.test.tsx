import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ConfirmPage } from './ConfirmPage'
import { LangProvider } from '../../i18n/useT'
import { ThemeProvider } from '../../lib/theme'
import { mockEngine } from '../../api/mock/engine'

function renderConfirmPage(initialToken = 'demo-confirm-token-apollo') {
  return render(
    <MemoryRouter initialEntries={[`/confirm/${initialToken}`]}>
      <ThemeProvider>
        <LangProvider>
          <Routes>
            <Route path="/confirm/:token" element={<ConfirmPage />} />
          </Routes>
        </LangProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('ConfirmPage (/confirm/:token)', () => {
  beforeEach(() => {
    window.innerWidth = 1200
    mockEngine.reset()
  })

  it('renders request preview with hospital, blood group, component, units, and masked patient ref', async () => {
    renderConfirmPage('demo-confirm-token-apollo')

    // Wait for preview to load
    expect(
      await screen.findByText('Confirm Hospital Blood Request', {}, { timeout: 4000 }),
    ).toBeInTheDocument()

    // Hospital Name
    expect(screen.getByText('Metropolitan Care Hospital, Chennai')).toBeInTheDocument()

    // Blood Group
    expect(screen.getByText('B+')).toBeInTheDocument()

    // Units
    expect(screen.getByText('1')).toBeInTheDocument()

    // Masked patient reference
    expect(screen.getByText('IP-••••')).toBeInTheDocument()

    // Action buttons
    expect(screen.getByRole('button', { name: /Raise this request/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Not our patient/i })).toBeInTheDocument()
  })

  it('handles "Raise this request": starts outreach and shows raised result state with status link', async () => {
    renderConfirmPage('demo-confirm-token-apollo')

    const raiseBtn = await screen.findByRole('button', { name: /Raise this request/i }, { timeout: 4000 })

    await act(async () => {
      fireEvent.click(raiseBtn)
    })

    // Result state: Raised
    expect(
      await screen.findByText('Request raised successfully', {}, { timeout: 4000 }),
    ).toBeInTheDocument()

    // Status link
    const statusLink = screen.getByRole('link', { name: /View live request status/i })
    expect(statusLink).toBeInTheDocument()
    expect(statusLink).toHaveAttribute('href', '/hospital')
  })

  it('handles "Not our patient": transitions to rejected state', async () => {
    renderConfirmPage('demo-confirm-token-apollo')

    const rejectBtn = await screen.findByRole('button', { name: /Not our patient/i }, { timeout: 4000 })

    await act(async () => {
      fireEvent.click(rejectBtn)
    })

    // Result state: Rejected
    expect(await screen.findByText('Request rejected', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText(/Not our patient/i)).toBeInTheDocument()
  })

  it('displays expired/used error when token is invalid or already consumed', async () => {
    renderConfirmPage('invalid-or-consumed-token-123')

    expect(
      await screen.findByText(
        'This confirmation link has expired, was already used, or is invalid.',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()
  })
})
