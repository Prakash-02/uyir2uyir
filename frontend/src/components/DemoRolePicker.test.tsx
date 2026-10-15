import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DemoRolePicker } from './DemoRolePicker'
import { LangProvider } from '../i18n/useT'

// Mock firebase lib
vi.mock('../lib/firebase', () => {
  let mockUser: unknown = null
  let mockAuthListeners: Array<(user: unknown) => void> = []

  return {
    signInDemoRole: vi.fn().mockImplementation(async (role: string) => {
      mockUser = { uid: `uid-${role}` }
      mockAuthListeners.forEach((fn) => fn(mockUser))
      return { ok: true, uid: `uid-${role}`, role, claims: { role, env: 'demo' } }
    }),
    signOutCurrentUser: vi.fn().mockImplementation(async () => {
      mockUser = null
      mockAuthListeners.forEach((fn) => fn(null))
    }),
    onAuthChange: vi.fn().mockImplementation((cb: (user: unknown) => void) => {
      mockAuthListeners.push(cb)
      cb(mockUser)
      return () => {
        mockAuthListeners = mockAuthListeners.filter((fn) => fn !== cb)
      }
    }),
  }
})

describe('DemoRolePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders role options on root path /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LangProvider>
          <DemoRolePicker />
        </LangProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Hospital demo/i)).toBeInTheDocument()
    expect(screen.getByText(/Blood centre demo/i)).toBeInTheDocument()
    expect(screen.getByText(/Select Demo Role \(Anonymous Auth\)/i)).toBeInTheDocument()
  })

  it('does not render on non-root paths like /hospital', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/hospital']}>
        <LangProvider>
          <DemoRolePicker />
        </LangProvider>
      </MemoryRouter>,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('triggers signInDemoRole when Hospital demo is clicked', async () => {
    const { signInDemoRole } = await import('../lib/firebase')

    render(
      <MemoryRouter initialEntries={['/']}>
        <LangProvider>
          <DemoRolePicker />
        </LangProvider>
      </MemoryRouter>,
    )

    const hospitalBtn = screen.getByRole('button', {
      name: /Hospital Blood Bank demo user/i,
    })
    fireEvent.click(hospitalBtn)

    await waitFor(() => {
      expect(signInDemoRole).toHaveBeenCalledWith('hospital')
    })
  })

  it('triggers signInDemoRole when Blood centre demo is clicked', async () => {
    const { signInDemoRole } = await import('../lib/firebase')

    render(
      <MemoryRouter initialEntries={['/']}>
        <LangProvider>
          <DemoRolePicker />
        </LangProvider>
      </MemoryRouter>,
    )

    const centreBtn = screen.getByRole('button', {
      name: /Blood Centre Staff demo user/i,
    })
    fireEvent.click(centreBtn)

    await waitFor(() => {
      expect(signInDemoRole).toHaveBeenCalledWith('staff')
    })
  })
})
