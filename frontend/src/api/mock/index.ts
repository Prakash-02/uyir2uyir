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
import { mockEngine } from './engine'
import { runStory } from './story'

export class MockApiClient implements ApiClient {
  public async getConfig(): Promise<AppConfig> {
    return mockEngine.getConfig()
  }

  public async createRequest(input: CreateRequestInput): Promise<BloodRequest> {
    return mockEngine.createRequest(input)
  }

  public async cancelRequest(id: string): Promise<BloodRequest> {
    return mockEngine.cancelRequest(id)
  }

  public async getRequestStatus(id: string): Promise<PublicStatus> {
    return mockEngine.getRequestStatus(id)
  }

  public async checkDesk(text: string): Promise<DeskResult> {
    return mockEngine.checkDesk(text)
  }

  public async checkDeskImage(file: Blob, caption = ''): Promise<DeskResult> {
    return mockEngine.checkDeskImage(file, caption)
  }

  public async getConfirmPreview(token: string): Promise<RequestPreview> {
    return mockEngine.getConfirmPreview(token)
  }

  public async confirmRequest(
    token: string,
    action: ConfirmAction,
  ): Promise<BloodRequest | { status: 'REJECTED' }> {
    return mockEngine.confirmRequest(token, action)
  }

  public async simPressKey(callId: string, key: SimKey): Promise<Call> {
    return mockEngine.simPressKey(callId, key)
  }

  public async acceptCall(callId: string): Promise<Call> {
    return mockEngine.acceptCall(callId)
  }

  public async deferCall(callId: string, returnDate?: string): Promise<Call> {
    return mockEngine.deferCall(callId, returnDate)
  }

  public async signupDonor(input: DonorSignupInput): Promise<{ donorAlias: string }> {
    return mockEngine.signupDonor(input)
  }

  public async getMetrics(): Promise<Metrics> {
    return mockEngine.getMetrics()
  }

  public async getLatestEval(): Promise<EvalResult> {
    return mockEngine.getLatestEval()
  }

  public async runScenario(
    id: string,
    onStep?: (stepNumber: number, label: string) => void,
  ): Promise<{ ok: true }> {
    if (id === 'story' || id === 'demo' || id === '1') {
      await runStory({ stepDelayMs: 1500, onStep })
    }
    return { ok: true }
  }

  public async reset(): Promise<{ ok: true }> {
    mockEngine.reset()
    return { ok: true }
  }

  public async setWeatherAlert(on: boolean): Promise<AppConfig> {
    return mockEngine.setWeatherAlert(on)
  }

  public subscribeRequest(id: string, cb: (request: BloodRequest | null) => void): Unsubscribe {
    return mockEngine.subscribeRequest(id, cb)
  }

  public subscribeCalls(requestId: string, cb: (calls: Call[]) => void): Unsubscribe {
    return mockEngine.subscribeCalls(requestId, cb)
  }

  public subscribeEvents(requestId: string, cb: (events: TimelineEvent[]) => void): Unsubscribe {
    return mockEngine.subscribeEvents(requestId, cb)
  }

  public subscribeRequests(
    filter: { hospitalId?: string; centreId?: string },
    cb: (requests: BloodRequest[]) => void,
  ): Unsubscribe {
    return mockEngine.subscribeRequests(filter, cb)
  }

  public subscribeSimCalls(cb: (calls: Call[]) => void): Unsubscribe {
    return mockEngine.subscribeSimCalls(cb)
  }
}

export const mockClient = new MockApiClient()
export { mockEngine } from './engine'
export { runStory, resetStory } from './story'
export { evaluateCountingRule, isLateAccept } from './countingRule'
export { MOCK_HOSPITALS, MOCK_CENTRES, MOCK_DONORS } from './fixtures'
export { SAMPLE_MESSAGES } from './desk'
