import type { ApiClient, CreateRequestInput, DonorSignupInput, Unsubscribe } from '../client'
import type {
  AppConfig,
  BloodRequest,
  Call,
  ConfirmAction,
  DeskResult,
  EvalResult,
  Metrics,
  PublicStatus,
  RequestPreview,
  SimKey,
  TimelineEvent,
} from '../types'
import { getAuthToken } from '../../lib/firebase'
import {
  subscribeRequest,
  subscribeCalls,
  subscribeEvents,
  subscribeRequests,
  subscribeSimCalls,
} from './live'

export class ApiError extends Error {
  public readonly status: number
  public readonly code?: string
  public readonly details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 10000,
): Promise<T> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error('REQUEST_TIMEOUT')), timeoutMs)

  try {
    const token = await getAuthToken()
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      let errData: { detail?: string; code?: string } = {}
      try {
        errData = (await response.json()) as { detail?: string; code?: string }
      } catch {
        // Response was not JSON
      }
      const message = errData.detail || `HTTP ${response.status}: ${response.statusText}`
      throw new ApiError(message, response.status, errData.code, errData)
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message === 'REQUEST_TIMEOUT')
    ) {
      throw new ApiError(
        `Request to ${path} timed out after ${timeoutMs}ms`,
        408,
        'TIMEOUT',
      )
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown network error',
      0,
      'NETWORK_ERROR',
      error,
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Production-ready HTTP API client implementing ApiClient.
 * Interacts with backend FastAPI endpoints on Cloud Run and real-time Firestore listeners.
 */
export class HttpApiClient implements ApiClient {
  public async getConfig(): Promise<AppConfig> {
    return request<AppConfig>('/config')
  }

  public async createRequest(input: CreateRequestInput): Promise<BloodRequest> {
    return request<BloodRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  public async cancelRequest(id: string): Promise<BloodRequest> {
    return request<BloodRequest>(`/requests/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    })
  }

  public async getRequestStatus(id: string): Promise<PublicStatus> {
    return request<PublicStatus>(`/requests/${encodeURIComponent(id)}/status`)
  }

  public async checkDesk(text: string): Promise<DeskResult> {
    return request<DeskResult>('/desk/check', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  }

  public async checkDeskImage(file: Blob, caption = ''): Promise<DeskResult> {
    const formData = new FormData()
    formData.append('image', file, 'upload.jpg')
    if (caption) {
      formData.append('text', caption)
    }
    return request<DeskResult>('/desk/check-image', {
      method: 'POST',
      body: formData,
    })
  }

  public async getConfirmPreview(token: string): Promise<RequestPreview> {
    return request<RequestPreview>(`/confirm/${encodeURIComponent(token)}`)
  }

  public async confirmRequest(
    token: string,
    action: ConfirmAction,
  ): Promise<BloodRequest | { status: 'REJECTED' }> {
    return request<BloodRequest | { status: 'REJECTED' }>('/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, action }),
    })
  }

  public async simPressKey(callId: string, key: SimKey): Promise<Call> {
    return request<Call>(`/sim/calls/${encodeURIComponent(callId)}/press`, {
      method: 'POST',
      body: JSON.stringify({ key }),
    })
  }

  public async acceptCall(callId: string): Promise<Call> {
    return request<Call>(`/calls/${encodeURIComponent(callId)}/accept`, {
      method: 'POST',
    })
  }

  public async deferCall(callId: string, returnDate?: string): Promise<Call> {
    return request<Call>(`/calls/${encodeURIComponent(callId)}/defer`, {
      method: 'POST',
      body: JSON.stringify({ returnDate }),
    })
  }

  public async signupDonor(input: DonorSignupInput): Promise<{ donorAlias: string }> {
    return request<{ donorAlias: string }>('/donors/signup', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  public async getMetrics(): Promise<Metrics> {
    return request<Metrics>('/metrics')
  }

  public async getLatestEval(): Promise<EvalResult> {
    return request<EvalResult>('/eval/latest')
  }

  public async runScenario(
    id: string,
    onStep?: (stepNumber: number, label: string) => void,
  ): Promise<{ ok: true }> {
    if (onStep) {
      onStep(1, `Running scenario: ${id}`)
    }
    await request<{ ok: true }>(`/admin/scenario/${encodeURIComponent(id)}/run`, {
      method: 'POST',
    })
    return { ok: true }
  }

  public async reset(): Promise<{ ok: true }> {
    await request<{ ok: true }>('/admin/reset', {
      method: 'POST',
    })
    return { ok: true }
  }

  public async setWeatherAlert(on: boolean): Promise<AppConfig> {
    return request<AppConfig>('/admin/settings/weather', {
      method: 'POST',
      body: JSON.stringify({ on }),
    })
  }

  public subscribeRequest(id: string, cb: (request: BloodRequest | null) => void): Unsubscribe {
    return subscribeRequest(id, cb)
  }

  public subscribeCalls(requestId: string, cb: (calls: Call[]) => void): Unsubscribe {
    return subscribeCalls(requestId, cb)
  }

  public subscribeEvents(requestId: string, cb: (events: TimelineEvent[]) => void): Unsubscribe {
    return subscribeEvents(requestId, cb)
  }

  public subscribeRequests(
    filter: { hospitalId?: string; centreId?: string },
    cb: (requests: BloodRequest[]) => void,
  ): Unsubscribe {
    return subscribeRequests(filter, cb)
  }

  public subscribeSimCalls(cb: (calls: Call[]) => void): Unsubscribe {
    return subscribeSimCalls(cb)
  }
}

export const httpClient = new HttpApiClient()
export * from './live'
