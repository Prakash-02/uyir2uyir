import type {
  BloodRequest,
  Call,
  TimelineEvent,
  AppConfig,
  PublicStatus,
  RequestPreview,
  ConfirmAction,
  SimKey,
  Metrics,
  EvalResult,
  DeskResult,
} from '../types'
import { evaluateCountingRule, isLateAccept } from './countingRule'
import { MOCK_HOSPITALS, MOCK_CENTRES, MOCK_DONORS } from './fixtures'
import { mockCheckDesk } from './desk'

type Listener<T> = (data: T) => void
type Unsubscribe = () => void

export interface CreateRequestOptions {
  hospitalId?: string
  hospitalName?: string
  centreId?: string
  centreName?: string
  bloodGroup: BloodRequest['bloodGroup']
  component: BloodRequest['component']
  unitsNeeded: number
  patientRef?: string
}

export class MockEngine {
  private requests = new Map<string, BloodRequest>()
  private calls = new Map<string, Call>()
  private events = new Map<string, TimelineEvent[]>()
  private confirmTokens = new Map<string, RequestPreview>()
  private donorCallIndex = 0

  private config: AppConfig = {
    dataMode: 'demo',
    bannerText: 'SIMULATED DATA · Demo mode · No real donors or patients',
    weatherAlert: false,
  }

  // Listeners
  private requestListeners = new Map<string, Set<Listener<BloodRequest | null>>>()
  private callsListeners = new Map<string, Set<Listener<Call[]>>>()
  private eventsListeners = new Map<string, Set<Listener<TimelineEvent[]>>>()
  private requestsQueryListeners = new Set<() => void>()
  private simCallsListeners = new Set<Listener<Call[]>>()

  constructor() {
    this.seedDefaultData()
  }

  public seedDefaultData(): void {
    this.requests.clear()
    this.calls.clear()
    this.events.clear()
    this.confirmTokens.clear()
    this.donorCallIndex = 0

    // Seed default open request for demo matching
    const reqId = 'req-demo-1'
    const defaultReq: BloodRequest = {
      id: reqId,
      hospitalId: MOCK_HOSPITALS[0].id,
      hospitalName: MOCK_HOSPITALS[0].name,
      centreId: MOCK_CENTRES[0].id,
      centreName: MOCK_CENTRES[0].name,
      bloodGroup: 'O+',
      component: 'RED_CELLS',
      unitsNeeded: 2,
      status: 'OPEN',
      accepted: 0,
      onTheWay: 0,
      round: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14400000).toISOString(),
      isSimulated: true,
      patientRef: 'IP-101',
    }

    this.requests.set(reqId, defaultReq)
    this.events.set(reqId, [
      {
        id: `ev-${Date.now()}-0`,
        requestId: reqId,
        at: new Date().toISOString(),
        kind: 'OPEN',
        text: `Request raised for 2 units of O+ RED_CELLS at ${MOCK_HOSPITALS[0].name}.`,
      },
    ])

    // Dial initial round of 5 donors
    this.dialNextRound(reqId, defaultReq.bloodGroup, 1)

    // Pre-populate a demo confirm token
    const demoToken = 'demo-confirm-token-apollo'
    this.confirmTokens.set(demoToken, {
      hospitalName: MOCK_HOSPITALS[1].name,
      bloodGroup: 'B+',
      component: 'RED_CELLS',
      unitsNeeded: 1,
      patientRefMasked: 'IP-••••',
      expiresAt: new Date(Date.now() + 7200000).toISOString(),
    })
  }

  public reset(): void {
    this.seedDefaultData()
    this.notifyAll()
  }

  // --- Subscriptions ---

  public subscribeRequest(id: string, cb: Listener<BloodRequest | null>): Unsubscribe {
    if (!this.requestListeners.has(id)) {
      this.requestListeners.set(id, new Set())
    }
    this.requestListeners.get(id)!.add(cb)
    cb(this.requests.get(id) ?? null)

    return () => {
      this.requestListeners.get(id)?.delete(cb)
    }
  }

  public subscribeCalls(requestId: string, cb: Listener<Call[]>): Unsubscribe {
    if (!this.callsListeners.has(requestId)) {
      this.callsListeners.set(requestId, new Set())
    }
    this.callsListeners.get(requestId)!.add(cb)
    cb(this.getCallsForRequest(requestId))

    return () => {
      this.callsListeners.get(requestId)?.delete(cb)
    }
  }

  public subscribeEvents(requestId: string, cb: Listener<TimelineEvent[]>): Unsubscribe {
    if (!this.eventsListeners.has(requestId)) {
      this.eventsListeners.set(requestId, new Set())
    }
    this.eventsListeners.get(requestId)!.add(cb)
    cb(this.events.get(requestId) ?? [])

    return () => {
      this.eventsListeners.get(requestId)?.delete(cb)
    }
  }

  public subscribeRequests(
    filter: { hospitalId?: string; centreId?: string },
    cb: Listener<BloodRequest[]>,
  ): Unsubscribe {
    const notify = () => {
      let list = Array.from(this.requests.values())
      if (filter.hospitalId) {
        list = list.filter((r) => r.hospitalId === filter.hospitalId)
      }
      if (filter.centreId) {
        list = list.filter((r) => r.centreId === filter.centreId)
      }
      cb(list)
    }

    this.requestsQueryListeners.add(notify)
    notify()

    return () => {
      this.requestsQueryListeners.delete(notify)
    }
  }

  public subscribeSimCalls(cb: Listener<Call[]>): Unsubscribe {
    this.simCallsListeners.add(cb)
    cb(this.getRingingCalls())

    return () => {
      this.simCallsListeners.delete(cb)
    }
  }

  // --- Read Methods ---

  public async getConfig(): Promise<AppConfig> {
    return { ...this.config }
  }

  public async setWeatherAlert(on: boolean): Promise<AppConfig> {
    this.config.weatherAlert = on
    this.notifyRequestsQuery()
    return { ...this.config }
  }

  public async getRequestStatus(id: string): Promise<PublicStatus> {
    const r = this.requests.get(id)
    if (!r) throw new Error(`Request not found: ${id}`)
    return {
      id: r.id,
      hospitalName: r.hospitalName,
      bloodGroup: r.bloodGroup,
      component: r.component,
      status: r.status,
    }
  }

  public async getMetrics(): Promise<Metrics> {
    return {
      requests: this.requests.size,
      medianMinutesToFirstOnTheWay: 12,
      medianMinutesToCovered: 26,
      medianMinutesToFulfilled: 48,
      baseline: { toFirstOnTheWay: 45, toCovered: 90, toFulfilled: 180 },
      callsPerAccepted: 2.8,
      standDownReachPct: 98.4,
      isSimulated: true,
    }
  }

  public async getLatestEval(): Promise<EvalResult> {
    return {
      promptVersion: 'v1.2-zero-temp',
      runAt: new Date().toISOString(),
      total: 50,
      correct: 49,
      paymentToHospital: 0,
      wrongHospitalIds: 0,
      p95LatencyMs: 840,
      rows: [
        { id: 'eval-1', expected: 'VERIFIED_MATCH', got: 'VERIFIED_MATCH', pass: true },
        { id: 'eval-2', expected: 'SENT_TO_HOSPITAL', got: 'SENT_TO_HOSPITAL', pass: true },
        { id: 'eval-3', expected: 'NOT_VERIFIED', got: 'NOT_VERIFIED', pass: true },
        { id: 'eval-4', expected: 'NOT_VERIFIED', got: 'NOT_VERIFIED', pass: true },
      ],
    }
  }

  public async checkDesk(text: string): Promise<DeskResult> {
    const openReqs = Array.from(this.requests.values()).map((r) => ({
      id: r.id,
      hospitalName: r.hospitalName,
      patientRef: r.patientRef,
    }))

    return mockCheckDesk(text, {
      openRequests: openReqs,
      generateConfirmToken: (hospName) => {
        const token = `token-${Date.now()}`
        this.confirmTokens.set(token, {
          hospitalName: hospName,
          bloodGroup: 'O+',
          component: 'RED_CELLS',
          unitsNeeded: 2,
          patientRefMasked: 'IP-••••',
          expiresAt: new Date(Date.now() + 7200000).toISOString(),
        })
        return token
      },
    })
  }

  public async getConfirmPreview(token: string): Promise<RequestPreview> {
    const preview = this.confirmTokens.get(token)
    if (!preview) throw new Error(`Invalid or expired confirm token: ${token}`)
    return preview
  }

  public async confirmRequest(
    token: string,
    action: ConfirmAction,
  ): Promise<BloodRequest | { status: 'REJECTED' }> {
    const preview = this.confirmTokens.get(token)
    if (!preview) throw new Error(`Invalid or expired confirm token: ${token}`)
    this.confirmTokens.delete(token)

    if (action === 'NOT_OUR_PATIENT') {
      return { status: 'REJECTED' }
    }

    return this.createRequest({
      hospitalName: preview.hospitalName,
      bloodGroup: preview.bloodGroup,
      component: preview.component,
      unitsNeeded: preview.unitsNeeded,
      patientRef: 'CONFIRMED-DESK',
    })
  }

  public async signupDonor(_input: {
    bloodGroup: BloodRequest['bloodGroup']
    lang: BloodRequest['bloodGroup'] extends string ? 'en' | 'ta' : never
  }): Promise<{ donorAlias: string }> {
    const newIdx = this.donorCallIndex + 1
    const alias = `Donor D${newIdx}`
    return { donorAlias: alias }
  }

  // --- Write / Mutation Methods ---

  public async createRequest(options: CreateRequestOptions): Promise<BloodRequest> {
    const id = `req-${Date.now()}`
    const hospital =
      MOCK_HOSPITALS.find((h) => h.id === options.hospitalId || h.name === options.hospitalName) ??
      MOCK_HOSPITALS[0]
    const centre =
      MOCK_CENTRES.find((c) => c.id === options.centreId || c.name === options.centreName) ??
      MOCK_CENTRES[0]

    const req: BloodRequest = {
      id,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      centreId: centre.id,
      centreName: centre.name,
      bloodGroup: options.bloodGroup,
      component: options.component,
      unitsNeeded: options.unitsNeeded,
      status: 'OPEN',
      accepted: 0,
      onTheWay: 0,
      round: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14400000).toISOString(),
      isSimulated: true,
      patientRef: options.patientRef,
    }

    this.requests.set(id, req)
    this.events.set(id, [
      {
        id: `ev-${Date.now()}-0`,
        requestId: id,
        at: new Date().toISOString(),
        kind: 'OPEN',
        text: `Request opened for ${req.unitsNeeded} units of ${req.bloodGroup} ${req.component} at ${req.hospitalName}.`,
      },
    ])

    // Dial Round 1
    this.dialNextRound(id, req.bloodGroup, 1)

    this.notifyRequest(id)
    this.notifyRequestsQuery()

    return req
  }

  public async cancelRequest(id: string): Promise<BloodRequest> {
    const req = this.requests.get(id)
    if (!req) throw new Error(`Request not found: ${id}`)

    req.status = 'CANCELLED'
    req.updatedAt = new Date().toISOString()

    // Cancel all active calls
    for (const call of this.getCallsForRequest(id)) {
      if (call.state === 'RINGING' || call.state === 'DIALING' || call.state === 'QUEUED') {
        call.state = 'CANCELLED'
        call.updatedAt = new Date().toISOString()
      }
    }

    this.addEvent(id, 'CANCELLED', 'Request cancelled by hospital staff.')
    this.notifyAllForRequest(id)
    return req
  }

  public async simPressKey(callId: string, key: SimKey): Promise<Call> {
    const call = this.calls.get(callId)
    if (!call) throw new Error(`Call not found: ${callId}`)

    const req = this.requests.get(call.requestId)
    if (!req) throw new Error(`Associated request not found: ${call.requestId}`)

    const now = new Date().toISOString()

    if (key === '1') {
      // Check if late accept
      if (isLateAccept(req.status)) {
        call.state = 'LATE_ACCEPT'
        call.updatedAt = now
        this.addEvent(
          req.id,
          'LATE_ACCEPT',
          `Donor ${call.donorAlias} responded with 1 after request was paused/fulfilled. Thanked and stood down.`,
        )
      } else {
        call.state = 'ON_THE_WAY'
        call.etaMinutes = Math.max(5, Math.round(call.distanceKm * 5 + 4))
        call.updatedAt = now
        req.onTheWay += 1
        req.updatedAt = now

        this.addEvent(
          req.id,
          'IVR',
          `Donor ${call.donorAlias} committed (pressed 1). ETA: ${call.etaMinutes} min away.`,
        )

        this.applyCountingRule(req)
      }
    } else if (key === '2') {
      // Pressed 2 (Can't / Decline)
      const wasOnTheWay = call.state === 'ON_THE_WAY'
      if (wasOnTheWay) {
        req.onTheWay = Math.max(0, req.onTheWay - 1)
        req.updatedAt = now
        call.state = 'CANCELLED'
        this.addEvent(
          req.id,
          'CANCELLED',
          `Donor ${call.donorAlias} previously en route stood down (pressed 2).`,
        )
      } else {
        call.state = 'DECLINED'
        call.updatedAt = now
        this.addEvent(req.id, 'IVR', `Donor ${call.donorAlias} declined call (pressed 2).`)
      }

      this.applyCountingRule(req)
    } else if (key === '9') {
      // Pressed 9 (Opt out)
      const wasOnTheWay = call.state === 'ON_THE_WAY'
      if (wasOnTheWay) {
        req.onTheWay = Math.max(0, req.onTheWay - 1)
        req.updatedAt = now
      }
      call.state = 'OPTED_OUT'
      call.updatedAt = now

      this.addEvent(
        req.id,
        'OPT_OUT',
        `Donor ${call.donorAlias} requested removal from pool (pressed 9).`,
      )

      this.applyCountingRule(req)
    }

    this.notifyAllForRequest(req.id)
    return call
  }

  public async acceptCall(callId: string): Promise<Call> {
    const call = this.calls.get(callId)
    if (!call) throw new Error(`Call not found: ${callId}`)

    const req = this.requests.get(call.requestId)
    if (!req) throw new Error(`Associated request not found: ${call.requestId}`)

    const now = new Date().toISOString()

    if (call.state === 'ON_THE_WAY') {
      req.onTheWay = Math.max(0, req.onTheWay - 1)
    }

    call.state = 'ACCEPTED'
    call.etaMinutes = 0
    call.updatedAt = now
    req.accepted += 1
    req.updatedAt = now

    this.addEvent(
      req.id,
      'ACCEPT',
      `Donor ${call.donorAlias} arrived and medically accepted by blood centre staff.`,
    )

    this.applyCountingRule(req)
    this.notifyAllForRequest(req.id)
    return call
  }

  public async deferCall(callId: string, returnDate?: string): Promise<Call> {
    const call = this.calls.get(callId)
    if (!call) throw new Error(`Call not found: ${callId}`)

    const req = this.requests.get(call.requestId)
    if (!req) throw new Error(`Associated request not found: ${call.requestId}`)

    const now = new Date().toISOString()

    if (call.state === 'ON_THE_WAY') {
      req.onTheWay = Math.max(0, req.onTheWay - 1)
    }

    call.state = 'DEFERRED'
    call.updatedAt = now
    req.updatedAt = now

    this.addEvent(
      req.id,
      'DEFER',
      `Donor ${call.donorAlias} deferred by staff${returnDate ? ` (Eligible again: ${returnDate})` : ''}.`,
    )

    this.applyCountingRule(req)
    this.notifyAllForRequest(req.id)
    return call
  }

  // --- Internal Rule Engine Helpers ---

  private applyCountingRule(req: BloodRequest): void {
    const previousStatus = req.status
    const ruleResult = evaluateCountingRule({
      unitsNeeded: req.unitsNeeded,
      accepted: req.accepted,
      onTheWay: req.onTheWay,
      currentStatus: req.status,
    })

    req.status = ruleResult.status
    req.updatedAt = new Date().toISOString()

    if (ruleResult.status === 'FULFILLED' && previousStatus !== 'FULFILLED') {
      // Stand-down logic on fulfilment:
      // Cancel all calls still ringing or dialling
      for (const call of this.getCallsForRequest(req.id)) {
        if (call.state === 'RINGING' || call.state === 'DIALING' || call.state === 'QUEUED') {
          call.state = 'CANCELLED'
          call.updatedAt = new Date().toISOString()
        } else if (call.state === 'ON_THE_WAY') {
          call.state = 'LATE_ACCEPT'
          call.updatedAt = new Date().toISOString()
        }
      }

      this.addEvent(
        req.id,
        'FULFILLED',
        `Request fulfilled! Target of ${req.unitsNeeded} units accepted. Stand-down notice sent to all remaining donors.`,
      )
    } else if (ruleResult.status === 'PAUSED' && previousStatus !== 'PAUSED') {
      this.addEvent(
        req.id,
        'PAUSE',
        `Enough donors on the way (${ruleResult.covered} of ${req.unitsNeeded} covered; N+1 reached). Automated calls paused.`,
      )
    } else if (ruleResult.status === 'OPEN' && previousStatus === 'PAUSED') {
      // Coverage dropped below N -> reopen and trigger next round!
      req.round += 1
      this.addEvent(
        req.id,
        'REOPEN',
        `Coverage dropped below target ${req.unitsNeeded}. Reopening outreach — dialing round ${req.round}.`,
      )
      this.dialNextRound(req.id, req.bloodGroup, req.round)
    }
  }

  private dialNextRound(requestId: string, bloodGroup: BloodRequest['bloodGroup'], roundNumber: number): void {
    // Select 5 donors from fixtures
    const available = MOCK_DONORS.filter(
      (d) => d.bloodGroup === bloodGroup || d.bloodGroup === 'O-',
    )
    const donorsPool = available.length >= 5 ? available : MOCK_DONORS

    const startIdx = ((roundNumber - 1) * 5) % donorsPool.length
    const roundDonors = donorsPool.slice(startIdx, startIdx + 5)

    for (const donor of roundDonors) {
      const callId = `call-${requestId}-${donor.id}-${roundNumber}`
      const call: Call = {
        id: callId,
        requestId,
        donorAlias: donor.alias,
        bloodGroup: donor.bloodGroup,
        lang: donor.lang,
        state: 'RINGING',
        round: roundNumber,
        etaMinutes: null,
        distanceKm: donor.distanceKm,
        updatedAt: new Date().toISOString(),
      }
      this.calls.set(callId, call)
    }

    this.addEvent(
      requestId,
      'DISPATCH',
      `Dialed 5 donors in round ${roundNumber} (${roundDonors.map((d) => d.alias).join(', ')}).`,
    )
  }

  private addEvent(requestId: string, kind: string, text: string): void {
    if (!this.events.has(requestId)) {
      this.events.set(requestId, [])
    }
    const ev: TimelineEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requestId,
      at: new Date().toISOString(),
      kind,
      text,
    }
    this.events.get(requestId)!.push(ev)
    this.notifyEvents(requestId)
  }

  private getCallsForRequest(requestId: string): Call[] {
    return Array.from(this.calls.values()).filter((c) => c.requestId === requestId)
  }

  private getRingingCalls(): Call[] {
    return Array.from(this.calls.values()).filter((c) => c.state === 'RINGING')
  }

  // --- Notification Dispatchers ---

  private notifyAllForRequest(requestId: string): void {
    this.notifyRequest(requestId)
    this.notifyCalls(requestId)
    this.notifyEvents(requestId)
    this.notifyRequestsQuery()
    this.notifySimCalls()
  }

  private notifyAll(): void {
    for (const reqId of this.requests.keys()) {
      this.notifyRequest(reqId)
      this.notifyCalls(reqId)
      this.notifyEvents(reqId)
    }
    this.notifyRequestsQuery()
    this.notifySimCalls()
  }

  private notifyRequest(id: string): void {
    const listeners = this.requestListeners.get(id)
    if (listeners) {
      const val = this.requests.get(id) ?? null
      listeners.forEach((fn) => fn(val))
    }
  }

  private notifyCalls(requestId: string): void {
    const listeners = this.callsListeners.get(requestId)
    if (listeners) {
      const calls = this.getCallsForRequest(requestId)
      listeners.forEach((fn) => fn(calls))
    }
  }

  private notifyEvents(requestId: string): void {
    const listeners = this.eventsListeners.get(requestId)
    if (listeners) {
      const evs = this.events.get(requestId) ?? []
      listeners.forEach((fn) => fn(evs))
    }
  }

  private notifyRequestsQuery(): void {
    this.requestsQueryListeners.forEach((fn) => fn())
  }

  private notifySimCalls(): void {
    const ringing = this.getRingingCalls()
    this.simCallsListeners.forEach((fn) => fn(ringing))
  }

  // For testing / inspection
  public getRequest(id: string): BloodRequest | undefined {
    return this.requests.get(id)
  }

  public getAllRequests(): BloodRequest[] {
    return Array.from(this.requests.values())
  }

  public getCall(callId: string): Call | undefined {
    return this.calls.get(callId)
  }

  public getAllCalls(): Call[] {
    return Array.from(this.calls.values())
  }
}

export const mockEngine = new MockEngine()
