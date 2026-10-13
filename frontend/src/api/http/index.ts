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

/**
 * Stub HTTP API client implementing ApiClient.
 * Full Cloud Run REST integration and Firestore listeners are implemented in Prompt 12.
 */
export class HttpApiClient implements ApiClient {
  public async getConfig(): Promise<AppConfig> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async createRequest(_input: CreateRequestInput): Promise<BloodRequest> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async cancelRequest(_id: string): Promise<BloodRequest> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async getRequestStatus(_id: string): Promise<PublicStatus> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async checkDesk(_text: string): Promise<DeskResult> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async getConfirmPreview(_token: string): Promise<RequestPreview> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async confirmRequest(
    _token: string,
    _action: ConfirmAction,
  ): Promise<BloodRequest | { status: 'REJECTED' }> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async simPressKey(_callId: string, _key: SimKey): Promise<Call> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async acceptCall(_callId: string): Promise<Call> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async deferCall(_callId: string, _returnDate?: string): Promise<Call> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async signupDonor(_input: DonorSignupInput): Promise<{ donorAlias: string }> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async getMetrics(): Promise<Metrics> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async getLatestEval(): Promise<EvalResult> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async runScenario(_id: string): Promise<{ ok: true }> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async reset(): Promise<{ ok: true }> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public async setWeatherAlert(_on: boolean): Promise<AppConfig> {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public subscribeRequest(_id: string, _cb: (request: BloodRequest | null) => void): Unsubscribe {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public subscribeCalls(_requestId: string, _cb: (calls: Call[]) => void): Unsubscribe {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public subscribeEvents(_requestId: string, _cb: (events: TimelineEvent[]) => void): Unsubscribe {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public subscribeRequests(
    _filter: { hospitalId?: string; centreId?: string },
    _cb: (requests: BloodRequest[]) => void,
  ): Unsubscribe {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }

  public subscribeSimCalls(_cb: (calls: Call[]) => void): Unsubscribe {
    throw new Error('HTTP client not implemented yet (scheduled for Prompt 12)')
  }
}

export const httpClient = new HttpApiClient()
