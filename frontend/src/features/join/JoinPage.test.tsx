import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { JoinPage } from './JoinPage'
import { LangProvider } from '../../i18n/useT'
import { ThemeProvider } from '../../lib/theme'
import { mockEngine } from '../../api/mock/engine'

function renderJoinPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LangProvider>
          <JoinPage />
        </LangProvider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('JoinPage (/join)', () => {
  beforeEach(() => {
    window.innerWidth = 1200
    mockEngine.reset()
  })

  it('renders LangToggle, data collection notice, and unticked consent checkboxes', async () => {
    renderJoinPage()

    // 1. LangToggle at top
    expect(screen.getByRole('button', { name: /Switch language/i })).toBeInTheDocument()

    // 2. Short privacy & data collection notice
    expect(screen.getByText(/What we collect and why/i)).toBeInTheDocument()
    expect(screen.getByText(/grievance@uyir2uyir\.org/i)).toBeInTheDocument()

    // Form inputs
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Mobile number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Blood group/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Area \/ Locality \/ PIN/i)).toBeInTheDocument()

    // 4 & 5. Unticked Consent Checkboxes
    const urgentCheckbox = screen.getByLabelText(
      /U2U may call me when someone near me needs my blood group\./i,
    ) as HTMLInputElement
    const historyCheckbox = screen.getByLabelText(
      /U2U may keep my donation history so I'm not called too early\./i,
    ) as HTMLInputElement
    const adultCheckbox = screen.getByLabelText(
      /I confirm that I am 18 years of age or older\./i,
    ) as HTMLInputElement

    expect(urgentCheckbox.checked).toBe(false)
    expect(historyCheckbox.checked).toBe(false)
    expect(adultCheckbox.checked).toBe(false)
  })

  it('keeps Join button disabled without urgent-contact consent and 18+ attestation', async () => {
    renderJoinPage()

    const nameInput = screen.getByLabelText(/Full name/i)
    const phoneInput = screen.getByLabelText(/Mobile number/i)
    const bloodGroupSelect = screen.getByLabelText(/^Blood group/i)
    const areaInput = screen.getByLabelText(/Area \/ Locality \/ PIN/i)
    const joinBtn = screen.getByRole('button', { name: /^Join/i })

    // Fill all form fields
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Karthik Subramanian' } })
      fireEvent.change(phoneInput, { target: { value: '9840123456' } })
      fireEvent.change(bloodGroupSelect, { target: { value: 'O+' } })
      fireEvent.change(areaInput, { target: { value: 'Mylapore, Chennai' } })
    })

    // Without checkboxes ticked -> Join MUST stay disabled
    expect(joinBtn).toBeDisabled()

    // Tick only 18+ attestation -> Still disabled
    const adultCheckbox = screen.getByLabelText(/I confirm that I am 18 years of age or older\./i)
    await act(async () => {
      fireEvent.click(adultCheckbox)
    })
    expect(joinBtn).toBeDisabled()

    // Tick urgent-contact consent -> Now enabled!
    const urgentCheckbox = screen.getByLabelText(
      /U2U may call me when someone near me needs my blood group\./i,
    )
    await act(async () => {
      fireEvent.click(urgentCheckbox)
    })
    expect(joinBtn).not.toBeDisabled()

    // Untick urgent-contact consent -> Disabled again!
    await act(async () => {
      fireEvent.click(urgentCheckbox)
    })
    expect(joinBtn).toBeDisabled()
  })

  it('validates Indian mobile numbers and shows error on invalid phone', async () => {
    renderJoinPage()

    const nameInput = screen.getByLabelText(/Full name/i)
    const phoneInput = screen.getByLabelText(/Mobile number/i)
    const bloodGroupSelect = screen.getByLabelText(/^Blood group/i)
    const areaInput = screen.getByLabelText(/Area \/ Locality \/ PIN/i)
    const urgentCheckbox = screen.getByLabelText(/U2U may call me when someone near me needs my blood group\./i)
    const adultCheckbox = screen.getByLabelText(/I confirm that I am 18 years of age or older\./i)

    fireEvent.change(nameInput, { target: { value: 'Priya Rajan' } })
    fireEvent.change(bloodGroupSelect, { target: { value: 'A+' } })
    fireEvent.change(areaInput, { target: { value: 'Adyar, Chennai' } })
    fireEvent.click(urgentCheckbox)
    fireEvent.click(adultCheckbox)

    // Enter invalid phone (too short or doesn't start with 6-9)
    fireEvent.change(phoneInput, { target: { value: '12345' } })

    const joinBtn = screen.getByRole('button', { name: /^Join/i })
    await act(async () => {
      fireEvent.click(joinBtn)
    })

    // Validation error appears
    expect(
      screen.getByText(/Please enter a valid 10-digit Indian mobile number\./i),
    ).toBeInTheDocument()
  })

  it('submits registration, shows success with donor alias, and NEVER displays phone back', async () => {
    renderJoinPage()

    const secretPhone = '9876543210'

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Anand Kumar' } })
    fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: secretPhone } })
    fireEvent.change(screen.getByLabelText(/^Blood group/i), { target: { value: 'B+' } })
    fireEvent.change(screen.getByLabelText(/Area \/ Locality \/ PIN/i), { target: { value: 'Anna Nagar, Chennai' } })
    fireEvent.click(screen.getByLabelText(/U2U may call me when someone near me needs my blood group\./i))
    fireEvent.click(screen.getByLabelText(/I confirm that I am 18 years of age or older\./i))

    const joinBtn = screen.getByRole('button', { name: /^Join/i })
    await act(async () => {
      fireEvent.click(joinBtn)
    })

    // 7. Success message with assigned alias
    expect(
      await screen.findByText(/You're in\. Your donor name is Donor D1\./i, {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/You'll only be called when you match and it's safe for you to donate\./i),
    ).toBeInTheDocument()

    // 8. Demo mode notice
    expect(
      screen.getByText('Demo: nothing is sent and no call will be made.'),
    ).toBeInTheDocument()

    // CRITICAL PRIVACY SAFETY ASSERTION: The submitted phone number MUST NEVER be displayed!
    expect(screen.queryByText(secretPhone)).not.toBeInTheDocument()
    expect(screen.queryByText(new RegExp(secretPhone))).not.toBeInTheDocument()
  })
})
