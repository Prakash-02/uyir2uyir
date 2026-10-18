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
  BloodGroup,
  Component,
  Lang,
  TimelineEvent,
} from './types'

export type Unsubscribe = () => void

export interface CreateRequestInput {
  bloodGroup: BloodGroup
  component: Component
  unitsNeeded: number
  patientRef?: string
  hospitalId?: string
  hospitalName?: string
  centreId?: string
  centreName?: string
}

export interface DonorSignupInput {
  name: string
  phone: string
  bloodGroup: BloodGroup
  area: string
  lang: Lang
  lastDonation?: string
  consentUrgent: boolean
  consentHistory: boolean
  adult: boolean
}

export interface ApiClient {
  // Endpoints from contract table
  getConfig(): Promise<AppConfig>
  createRequest(input: CreateRequestInput): Promise<BloodRequest>
  cancelRequest(id: string): Promise<BloodRequest>
  getRequestStatus(id: string): Promise<PublicStatus>
  checkDesk(text: string): Promise<DeskResult>
  checkDeskImage(file: Blob, caption?: string): Promise<DeskResult>
  getConfirmPreview(token: string): Promise<RequestPreview>
  confirmRequest(token: string, action: ConfirmAction): Promise<BloodRequest | { status: 'REJECTED' }>
  simPressKey(callId: string, key: SimKey): Promise<Call>
  acceptCall(callId: string): Promise<Call>
  deferCall(callId: string, returnDate?: string): Promise<Call>
  signupDonor(input: DonorSignupInput): Promise<{ donorAlias: string }>
  getMetrics(): Promise<Metrics>
  getLatestEval(): Promise<EvalResult>
  runScenario(id: string, onStep?: (stepNumber: number, label: string) => void): Promise<{ ok: true }>
  reset(): Promise<{ ok: true }>
  setWeatherAlert(on: boolean): Promise<AppConfig>

  // Realtime Listeners (Firestore in live mode, MockEngine in demo mode)
  subscribeRequest(id: string, cb: (request: BloodRequest | null) => void): Unsubscribe
  subscribeCalls(requestId: string, cb: (calls: Call[]) => void): Unsubscribe
  subscribeEvents(requestId: string, cb: (events: TimelineEvent[]) => void): Unsubscribe
  subscribeRequests(
    filter: { hospitalId?: string; centreId?: string },
    cb: (requests: BloodRequest[]) => void,
  ): Unsubscribe
  subscribeSimCalls(cb: (calls: Call[]) => void): Unsubscribe
}

import { mockClient } from './mock'
import { httpClient } from './http'

/**
 * Returns true if the build is running in production with mock client active.
 * Used to render a prominent OFFLINE MOCK BUILD warning in the header.
 */
export function isOfflineMockBuild(): boolean {
  return Boolean(import.meta.env.PROD && import.meta.env.VITE_API_MODE !== 'http')
}

/**
 * Returns the active ApiClient instance based on VITE_API_MODE (default: mock).
 * The UI screens never need to know whether mock or http mode is active.
 */
export function getApi(): ApiClient {
  const mode = import.meta.env.VITE_API_MODE
  if (mode === 'http') {
    return httpClient
  }
  return mockClient
}

