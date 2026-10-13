import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App smoke test', () => {
  it('renders App and finds the landing heading', () => {
    render(<App />)
    const heading = screen.getByRole('heading', { name: /U2U · Urgent Blood Relay/i })
    expect(heading).toBeInTheDocument()
  })
})
