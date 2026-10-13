import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProgressBanner } from './ProgressBanner'

describe('ProgressBanner', () => {
  it('renders progress bar with role status and aria-live polite', () => {
    render(<ProgressBanner unitsNeeded={2} accepted={0} onTheWay={1} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText(/1 on the way/i)).toBeInTheDocument()
  })

  it('calculates correct covered percentage and renders counts', () => {
    render(<ProgressBanner unitsNeeded={2} accepted={1} onTheWay={1} />)
    expect(screen.getByText(/2 \/ 2 units \(100%\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Accepted:/i)).toBeInTheDocument()
    expect(screen.getByText(/On the way:/i)).toBeInTheDocument()
  })

  it('renders fulfilled state text when accepted equals unitsNeeded', () => {
    render(<ProgressBanner unitsNeeded={2} accepted={2} onTheWay={0} />)
    expect(screen.getByText(/Request Fulfilled/i)).toBeInTheDocument()
  })
})
