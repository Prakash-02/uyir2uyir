import { MockEngine, mockEngine } from './engine'
import type { BloodRequest } from '../types'

export interface StoryOptions {
  engine?: MockEngine
  stepDelayMs?: number
  onStep?: (stepNumber: number, label: string) => void
}

export interface StoryRunResult {
  request: BloodRequest
  stepsCompleted: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Executes steps 1 through 5 of the demo story from U2U_BRIEF.md section 7:
 *
 * N = 2, so pause at covered 3, reopen below 2, fulfil at accepted 2.
 * 1. Hospital raises a request. Round 1 calls 5 donors (A to E). Status OPEN.
 * 2. A, B and C press 1, so covered is 3 (N+1) and the request PAUSES.
 *    D and E then press 1 too late and become LATE_ACCEPT.
 * 3. Staff accept A and defer B, so accepted is 1, on the way is 1 (C), covered is 2,
 *    and the request stays PAUSED.
 * 4. C, while on the way, presses 2 on a reminder call and becomes CANCELLED,
 *    so covered is 1 (below N) and the request REOPENS. Round 2 calls next 5 donors.
 * 5. F presses 1, then staff accept F, so accepted is 2 and the request is FULFILLED.
 *    Calls still ringing in round 2 become CANCELLED and anyone on the way is thanked.
 */
export async function runStory(options: StoryOptions = {}): Promise<StoryRunResult> {
  const engine = options.engine ?? mockEngine
  const delay = options.stepDelayMs ?? 1500
  const onStep = options.onStep ?? (() => {})

  // 1. Step 1: Hospital raises a request for 2 units of O+ red cells
  engine.reset()
  const req = await engine.createRequest({
    bloodGroup: 'O+',
    component: 'RED_CELLS',
    unitsNeeded: 2,
    patientRef: 'IP-DEMO-STORY',
  })

  onStep(
    1,
    'Step 1: Hospital raises urgent request for 2 units of O+ RED_CELLS. Round 1 calls 5 donors (A to E). Status: OPEN.',
  )
  if (delay > 0) await sleep(delay)

  // Retrieve the 5 calls from Round 1
  const round1Calls = engine.getAllCalls().filter((c) => c.requestId === req.id && c.round === 1)
  const [callA, callB, callC, callD, callE] = round1Calls

  // 2. Step 2: A, B and C press 1 -> covered reaches 3 (N+1) -> PAUSES.
  // Then D and E press 1 -> become LATE_ACCEPT.
  if (callA) await engine.simPressKey(callA.id, '1')
  if (callB) await engine.simPressKey(callB.id, '1')
  if (callC) await engine.simPressKey(callC.id, '1') // Triggers PAUSE at covered = 3

  if (callD) await engine.simPressKey(callD.id, '1') // Late accept
  if (callE) await engine.simPressKey(callE.id, '1') // Late accept

  onStep(
    2,
    'Step 2: Donors A, B, C press 1 (covered reaches 3, N+1). Request PAUSES. Donors D and E press 1 too late (LATE_ACCEPT).',
  )
  if (delay > 0) await sleep(delay)

  // 3. Step 3: Staff accept A and defer B -> accepted = 1, onTheWay = 1 (C), covered = 2.
  // Request stays PAUSED.
  if (callA) await engine.acceptCall(callA.id)
  if (callB) await engine.deferCall(callB.id)

  onStep(
    3,
    'Step 3: Staff accepts Donor A and defers Donor B. Accepted = 1, on the way = 1 (Donor C). Covered = 2. Request stays PAUSED.',
  )
  if (delay > 0) await sleep(delay)

  // 4. Step 4: C, while on the way, presses 2 on a reminder call and becomes CANCELLED.
  // Covered drops to 1 (< N) -> Request REOPENS! Round 2 calls next 5 donors.
  if (callC) await engine.simPressKey(callC.id, '2')

  onStep(
    4,
    'Step 4: Donor C cancels (pressed 2). Covered drops to 1 (< N). Request REOPENS! Automated dialer dispatches Round 2.',
  )
  if (delay > 0) await sleep(delay)

  // 5. Step 5: Donor F (first donor of Round 2) presses 1, then staff accepts F.
  // Accepted reaches 2 (N) -> Request FULFILLED!
  const round2Calls = engine.getAllCalls().filter((c) => c.requestId === req.id && c.round === 2)
  const callF = round2Calls[0]

  if (callF) {
    await engine.simPressKey(callF.id, '1')
    await engine.acceptCall(callF.id)
  }

  onStep(
    5,
    'Step 5: Donor F presses 1, staff accepts Donor F. Accepted = 2 (target N reached). Request FULFILLED! Remaining calls cancelled.',
  )

  const finalReq = engine.getRequest(req.id) ?? req

  return {
    request: finalReq,
    stepsCompleted: 5,
  }
}

export function resetStory(engine?: MockEngine): void {
  const e = engine ?? mockEngine
  e.reset()
}
