import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpApiClient, ApiError } from './index'
import {
  subscribeRequest,
  subscribeCalls,
  subscribeEvents,
  subscribeRequests,
  subscribeSimCalls,
} from './live'

describe('HttpApiClient', () => {
  let client: HttpApiClient
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    client = new HttpApiClient()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('handles successful JSON response from /config', async () => {
    const mockConfig = {
      dataMode: 'demo' as const,
      bannerText: 'SIMULATED DATA',
      weatherAlert: false,
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockConfig,
    } as Response)

    const result = await client.getConfig()
    expect(result).toEqual(mockConfig)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/config'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('throws typed ApiError on 4xx/5xx responses with backend detail', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ detail: 'Invalid blood group specified' }),
    } as Response)

    await expect(
      client.createRequest({
        bloodGroup: 'O+',
        component: 'RED_CELLS',
        unitsNeeded: 2,
      }),
    ).rejects.toThrow(ApiError)

    try {
      await client.createRequest({
        bloodGroup: 'O+',
        component: 'RED_CELLS',
        unitsNeeded: 2,
      })
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(400)
      expect(apiErr.message).toBe('Invalid blood group specified')
    }
  })

  it('POSTs /requests with JSON payload', async () => {
    const mockRequest = {
      id: 'req-123',
      hospitalId: 'hosp-1',
      hospitalName: 'Sample Hospital',
      centreId: 'centre-1',
      centreName: 'Sample Centre',
      bloodGroup: 'O+' as const,
      component: 'RED_CELLS' as const,
      unitsNeeded: 2,
      status: 'OPEN' as const,
      accepted: 0,
      onTheWay: 0,
      round: 1,
      createdAt: '2026-10-15T12:00:00Z',
      updatedAt: '2026-10-15T12:00:00Z',
      expiresAt: '2026-10-15T16:00:00Z',
      isSimulated: true,
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRequest,
    } as Response)

    const res = await client.createRequest({
      bloodGroup: 'O+',
      component: 'RED_CELLS',
      unitsNeeded: 2,
      patientRef: 'REF-999',
    })

    expect(res).toEqual(mockRequest)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/requests'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          bloodGroup: 'O+',
          component: 'RED_CELLS',
          unitsNeeded: 2,
          patientRef: 'REF-999',
        }),
      }),
    )
  })

  it('POSTs /desk/check and handles desk verify result', async () => {
    const mockDeskResult = {
      answer: 'VERIFIED_MATCH' as const,
      message: 'Verified match for O+ red cells',
      footer: 'Nobody may charge you for a donor.' as const,
      trace: {
        hospital: { value: 'Sample General', quote: 'Sample General', kept: true },
        patientNumber: { value: 'P-123', quote: 'P-123', kept: true },
        bloodGroup: { value: 'O+' as const, quote: 'O+', kept: true },
        component: { value: 'RED_CELLS' as const, quote: 'red cells', kept: true },
        units: { value: 2, quote: '2 units', kept: true },
        paymentPhrases: [],
        geminiChoice: 'VERIFIED_MATCH',
        codeDecision: 'VERIFIED_MATCH',
      },
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDeskResult,
    } as Response)

    const result = await client.checkDesk('Urgent O+ red cells needed at Sample General')
    expect(result.answer).toBe('VERIFIED_MATCH')
    expect(result.footer).toBe('Nobody may charge you for a donor.')
  })
})

describe('Firestore live subscriptions without configured credentials', () => {
  it('safely returns no-op unsubscribe functions and empty arrays/null when Firestore unconfigured', () => {
    const cbReq = vi.fn()
    const unsub1 = subscribeRequest('req-99', cbReq)
    expect(typeof unsub1).toBe('function')
    unsub1()

    const cbCalls = vi.fn()
    const unsub2 = subscribeCalls('req-99', cbCalls)
    expect(typeof unsub2).toBe('function')
    unsub2()

    const cbEvents = vi.fn()
    const unsub3 = subscribeEvents('req-99', cbEvents)
    expect(typeof unsub3).toBe('function')
    unsub3()

    const cbReqs = vi.fn()
    const unsub4 = subscribeRequests({ hospitalId: 'hosp-1' }, cbReqs)
    expect(typeof unsub4).toBe('function')
    unsub4()

    const cbSim = vi.fn()
    const unsub5 = subscribeSimCalls(cbSim)
    expect(typeof unsub5).toBe('function')
    unsub5()
  })
})
