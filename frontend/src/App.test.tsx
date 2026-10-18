import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App smoke test & landing page', () => {
  it('renders App and finds the landing hero heading and tagline', async () => {
    render(<App />)
    const heading = await screen.findByRole('heading', { name: /Uyir2Uyir/i, level: 1 })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText(/Life passes on\. Freely\. Safely\. In time\./i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Run the story/i)).toBeInTheDocument())
  })

  it('renders the three promises cards (Freely, Safely, In time)', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /^Freely$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Safely$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^In time$/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Run the story/i)).toBeInTheDocument())
  })

  it('renders role cards linking to /hospital, /centre, /desk and /join', async () => {
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: /Uyir2Uyir/i, level: 1 })
    expect(container.querySelector('a[href="/hospital"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/centre"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/desk"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/join"]')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Run the story/i)).toBeInTheDocument())
  })

  it('renders the 4-step How It Works strip', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /How It Works/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Hospital raises/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /U2U calls 5 donors/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Donors press 1/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Staff accept/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/Run the story/i)).toBeInTheDocument())
  })

  it('renders the demo banner with Run the story action', async () => {
    render(<App />)
    expect(await screen.findByText(/Run the story/i)).toBeInTheDocument()
    expect(screen.getAllByText(/SIMULATED DATA/i).length).toBeGreaterThan(0)
  })

  it('excludes Styleguide from header navigation and provides Design system in footer', async () => {
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: /Uyir2Uyir/i, level: 1 })

    // Header nav should not contain Styleguide link
    const headerNav = container.querySelector('header nav')
    expect(headerNav).not.toBeNull()
    expect(headerNav?.querySelector('a[href="/styleguide"]')).toBeNull()

    // Footer must contain the Design system link pointing to /styleguide
    const footer = container.querySelector('footer')
    expect(footer).not.toBeNull()
    const designSystemLink = footer?.querySelector('a[href="/styleguide"]')
    expect(designSystemLink).toBeInTheDocument()
    expect(designSystemLink?.textContent).toMatch(/Design system/i)
  })
})
