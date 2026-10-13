import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConsentCheckbox } from './ConsentCheckbox'

describe('ConsentCheckbox', () => {
  it('is unticked by default and renders full sentence label', () => {
    const handleChange = vi.fn()
    render(
      <ConsentCheckbox
        id="test-consent"
        checked={false}
        onChange={handleChange}
        label="I consent to receiving automated phone calls when nearby."
      />,
    )
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
    expect(
      screen.getByText('I consent to receiving automated phone calls when nearby.'),
    ).toBeInTheDocument()
  })

  it('calls onChange when clicked', () => {
    const handleChange = vi.fn()
    render(
      <ConsentCheckbox
        id="test-consent"
        checked={false}
        onChange={handleChange}
        label="I consent to receiving automated phone calls."
      />,
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('renders error message with role alert when error prop is passed', () => {
    render(
      <ConsentCheckbox
        id="test-consent"
        checked={false}
        onChange={() => {}}
        label="I consent to receiving automated phone calls."
        error="Consent is mandatory."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Consent is mandatory.')
  })
})
