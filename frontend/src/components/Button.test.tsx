import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders button children text', () => {
    render(<Button>Submit Request</Button>)
    expect(screen.getByRole('button', { name: /Submit Request/i })).toBeInTheDocument()
  })

  it('is disabled while loading and shows loading indicator', () => {
    render(<Button isLoading>Submit Request</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument()
  })

  it('triggers onClick handler when clicked in normal state', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click Me</Button>)
    fireEvent.click(screen.getByRole('button', { name: /Click Me/i }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not trigger onClick when disabled or loading', () => {
    const handleClick = vi.fn()
    render(
      <Button isLoading onClick={handleClick}>
        Click Me
      </Button>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })
})
