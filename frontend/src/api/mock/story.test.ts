import { describe, it, expect, vi } from 'vitest'
import { runStory } from './story'
import { MockEngine } from './engine'

describe('Demo Story Scenario Runner (runStory)', () => {
  it('passes through PAUSED, reopens to OPEN (round 2), ends with FULFILLED and accepted = 2, with D and E as LATE_ACCEPT', async () => {
    const engine = new MockEngine()
    const observedSteps: { step: number; label: string; status?: string }[] = []

    const onStep = vi.fn((stepNumber: number, label: string) => {
      // Find current request status for the demo story request at this step
      const req = engine.getAllRequests().find(
        (r) => r.patientRef === 'IP-DEMO-STORY',
      )
      observedSteps.push({
        step: stepNumber,
        label,
        status: req ? req.status : undefined,
      })
    })

    const result = await runStory({
      engine,
      stepDelayMs: 0, // fast execution for unit test
      onStep,
    })

    // 1. Verify all 5 steps were reported
    expect(onStep).toHaveBeenCalledTimes(5)
    expect(result.stepsCompleted).toBe(5)

    // 2. Step 1 was OPEN
    expect(observedSteps[0].step).toBe(1)
    expect(observedSteps[0].status).toBe('OPEN')

    // 3. Step 2 was PAUSED (covered reached 3 for N=2)
    expect(observedSteps[1].step).toBe(2)
    expect(observedSteps[1].status).toBe('PAUSED')

    // 4. Step 3 was PAUSED (accepted = 1, onTheWay = 1 -> covered = 2)
    expect(observedSteps[2].step).toBe(3)
    expect(observedSteps[2].status).toBe('PAUSED')

    // 5. Step 4 REOPENED (covered dropped to 1 < N=2)
    expect(observedSteps[3].step).toBe(4)
    expect(observedSteps[3].status).toBe('OPEN')

    // 6. Step 5 reached FULFILLED (accepted = 2)
    expect(observedSteps[4].step).toBe(5)
    expect(observedSteps[4].status).toBe('FULFILLED')

    // 7. Verify final request attributes
    expect(result.request.status).toBe('FULFILLED')
    expect(result.request.accepted).toBe(2)
    expect(result.request.round).toBe(2)

    // 8. Verify Donor D and Donor E ended as LATE_ACCEPT
    const round1Calls = engine
      .getAllCalls()
      .filter((c) => c.requestId === result.request.id && c.round === 1)

    const callD = round1Calls[3]
    const callE = round1Calls[4]

    expect(callD).toBeDefined()
    expect(callD.state).toBe('LATE_ACCEPT')

    expect(callE).toBeDefined()
    expect(callE.state).toBe('LATE_ACCEPT')
  })
})
