import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HospitalPage } from './HospitalPage'
import { LangProvider } from '../../i18n/useT'
import { ThemeProvider } from '../../lib/theme'
import { mockEngine } from '../../api/mock/engine'

function renderHospitalPage() {
  return render(
    <ThemeProvider>
      <LangProvider>
        <HospitalPage />
      </LangProvider>
    </ThemeProvider>,
  )
}

describe('HospitalPage (/hospital)', () => {
  beforeEach(() => {
    mockEngine.reset()
  })

  it('renders the demo role note at the top', () => {
    renderHospitalPage()
    expect(screen.getByText(/Signed in as: Sample General Hospital \(demo\)/i)).toBeInTheDocument()
  })

  it('validates required patient reference before raising request', async () => {
    renderHospitalPage()
    const submitBtn = screen.getByRole('button', { name: /Raise request/i })

    // Click without entering patient reference
    fireEvent.click(submitBtn)

    expect(await screen.findByText(/Patient reference is required/i)).toBeInTheDocument()
  })

  it('raising a 2 unit request shows the ProgressBanner with "need 2"', async () => {
    renderHospitalPage()

    // Fill in patient reference and select 2 units
    const patientInput = screen.getByPlaceholderText(/e\.g\. IP-101/i)
    fireEvent.change(patientInput, { target: { value: 'IP-UNIT-TEST-2' } })

    const unitsSelect = screen.getByLabelText(/Units needed/i)
    fireEvent.change(unitsSelect, { target: { value: '2' } })

    const submitBtn = screen.getByRole('button', { name: /Raise request/i })
    fireEvent.click(submitBtn)

    // ProgressBanner should display the live coverage text containing "need 2"
    await waitFor(() => {
      const banner = screen.getByText(/need 2/i)
      expect(banner).toBeInTheDocument()
    })
  })

  it('opens cancellation dialog when Cancel request is clicked', async () => {
    renderHospitalPage()

    const cancelBtn = await screen.findByRole('button', { name: /Cancel request/i })
    fireEvent.click(cancelBtn)

    expect(await screen.findByText(/Cancel blood request\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Confirm cancellation/i)).toBeInTheDocument()
  })

  it('shows fulfilled success card and Uyir chain message button when request is fulfilled', async () => {
    renderHospitalPage()

    // Raise a request and then manually fulfill it in mockEngine to verify UI
    const patientInput = screen.getByPlaceholderText(/e\.g\. IP-101/i)
    fireEvent.change(patientInput, { target: { value: 'IP-FULFIL-TEST' } })
    fireEvent.click(screen.getByRole('button', { name: /Raise request/i }))

    await waitFor(() => expect(screen.getByText(/IP-FULFIL-TEST/i)).toBeInTheDocument())

    // Simulate staff acceptance of calls to reach target in engine wrapped in act
    const activeReq = mockEngine.getAllRequests().find((r) => r.patientRef === 'IP-FULFIL-TEST')
    expect(activeReq).toBeDefined()

    const calls = mockEngine.getAllCalls().filter((c) => c.requestId === activeReq!.id)
    await act(async () => {
      await mockEngine.simPressKey(calls[0].id, '1')
      await mockEngine.acceptCall(calls[0].id)
      await mockEngine.simPressKey(calls[1].id, '1')
      await mockEngine.acceptCall(calls[1].id)
    })

    // UI should show Fulfilled success card
    expect(await screen.findByText(/Fulfilled by the blood centre\./i)).toBeInTheDocument()
    const chainBtn = screen.getByRole('button', { name: /Send Uyir chain message/i })
    expect(chainBtn).toBeInTheDocument()

    // Click opens window.open
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    fireEvent.click(chainBtn)
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank',
      expect.any(String),
    )
    openSpy.mockRestore()
  })
})
