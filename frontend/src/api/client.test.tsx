import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { isOfflineMockBuild, getApi } from './client'
import { mockClient } from './mock'
import { httpClient } from './http'
import { AppShell } from '../components/AppShell'
import { LangProvider } from '../i18n/useT'
import { ThemeProvider } from '../lib/theme'

describe('ApiClient mode resolution & production mock guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('isOfflineMockBuild returns true when in PROD with mock mode active', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_API_MODE', 'mock')

    expect(isOfflineMockBuild()).toBe(true)
  })

  it('isOfflineMockBuild returns false in PROD when VITE_API_MODE is http', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_API_MODE', 'http')

    expect(isOfflineMockBuild()).toBe(false)
  })

  it('isOfflineMockBuild returns false when not in PROD (dev / local test)', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_API_MODE', 'mock')

    expect(isOfflineMockBuild()).toBe(false)
  })

  it('getApi returns httpClient when VITE_API_MODE is http', () => {
    vi.stubEnv('VITE_API_MODE', 'http')

    expect(getApi()).toBe(httpClient)
  })

  it('getApi returns mockClient when VITE_API_MODE is not http', () => {
    vi.stubEnv('VITE_API_MODE', 'mock')

    expect(getApi()).toBe(mockClient)
  })

  it('renders visible red OFFLINE MOCK BUILD badge in the header when in production with mock mode', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_API_MODE', 'mock')

    render(
      <MemoryRouter>
        <ThemeProvider>
          <LangProvider>
            <AppShell>
              <div>Page Content</div>
            </AppShell>
          </LangProvider>
        </ThemeProvider>
      </MemoryRouter>,
    )

    const badge = screen.getByTestId('offline-mock-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent(/OFFLINE MOCK BUILD/i)
  })

  it('does NOT render OFFLINE MOCK BUILD badge when in production with http mode', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_API_MODE', 'http')

    render(
      <MemoryRouter>
        <ThemeProvider>
          <LangProvider>
            <AppShell>
              <div>Page Content</div>
            </AppShell>
          </LangProvider>
        </ThemeProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByTestId('offline-mock-badge')).toBeNull()
  })
})
