import { describe, it, expect } from 'vitest'
import { evaluateCountingRule, isLateAccept } from './countingRule'
import type { RequestStatus } from '../types'

describe('U2U Counting Rule Pure Engine', () => {
  interface TestCase {
    desc: string
    unitsNeeded: number
    accepted: number
    onTheWay: number
    currentStatus: RequestStatus
    expectedStatus: RequestStatus
  }

  const testCases: TestCase[] = [
    // 1. Initial outreach (covered < N)
    {
      desc: 'stays OPEN when outreach starts (0 accepted, 1 on the way, N=2)',
      unitsNeeded: 2,
      accepted: 0,
      onTheWay: 1,
      currentStatus: 'OPEN',
      expectedStatus: 'OPEN',
    },
    // 2. Pause at N+1 (one spare donor)
    {
      desc: 'pauses at N+1 (0 accepted, 3 on the way, N=2 -> covered=3 >= N+1)',
      unitsNeeded: 2,
      accepted: 0,
      onTheWay: 3,
      currentStatus: 'OPEN',
      expectedStatus: 'PAUSED',
    },
    {
      desc: 'pauses at N+1 with partial acceptance (1 accepted, 2 on the way, N=2 -> covered=3)',
      unitsNeeded: 2,
      accepted: 1,
      onTheWay: 2,
      currentStatus: 'OPEN',
      expectedStatus: 'PAUSED',
    },
    // 3. Stays PAUSED when covered is between N and N+1 (covered == N)
    {
      desc: 'stays PAUSED when covered == N after deferral (1 accepted, 1 on the way, N=2)',
      unitsNeeded: 2,
      accepted: 1,
      onTheWay: 1,
      currentStatus: 'PAUSED',
      expectedStatus: 'PAUSED',
    },
    // 4. Reopens when covered drops below N
    {
      desc: 'reopens below N when donor drops out (1 accepted, 0 on the way, N=2 -> covered=1 < 2)',
      unitsNeeded: 2,
      accepted: 1,
      onTheWay: 0,
      currentStatus: 'PAUSED',
      expectedStatus: 'OPEN',
    },
    {
      desc: 'reopens below N when initial on-the-way donor declines (0 accepted, 0 on the way, N=2)',
      unitsNeeded: 2,
      accepted: 0,
      onTheWay: 0,
      currentStatus: 'PAUSED',
      expectedStatus: 'OPEN',
    },
    // 5. Fulfils when accepted reaches or exceeds target N
    {
      desc: 'fulfils when accepted == N (2 accepted, 0 on the way, N=2)',
      unitsNeeded: 2,
      accepted: 2,
      onTheWay: 0,
      currentStatus: 'OPEN',
      expectedStatus: 'FULFILLED',
    },
    {
      desc: 'fulfils when accepted == N even if other donors are still on the way',
      unitsNeeded: 2,
      accepted: 2,
      onTheWay: 1,
      currentStatus: 'PAUSED',
      expectedStatus: 'FULFILLED',
    },
    {
      desc: 'fulfils when accepted exceeds N (e.g. 3 accepted, N=2)',
      unitsNeeded: 2,
      accepted: 3,
      onTheWay: 0,
      currentStatus: 'OPEN',
      expectedStatus: 'FULFILLED',
    },
    // 6. Terminal states do not resurrect
    {
      desc: 'does not resurrect CANCELLED requests',
      unitsNeeded: 2,
      accepted: 0,
      onTheWay: 0,
      currentStatus: 'CANCELLED',
      expectedStatus: 'CANCELLED',
    },
    {
      desc: 'does not resurrect REJECTED requests',
      unitsNeeded: 2,
      accepted: 0,
      onTheWay: 0,
      currentStatus: 'REJECTED',
      expectedStatus: 'REJECTED',
    },
  ]

  testCases.forEach(
    ({ desc, unitsNeeded, accepted, onTheWay, currentStatus, expectedStatus }) => {
      it(desc, () => {
        const res = evaluateCountingRule({
          unitsNeeded,
          accepted,
          onTheWay,
          currentStatus,
        })
        expect(res.status).toBe(expectedStatus)
      })
    },
  )

  describe('isLateAccept', () => {
    it('returns true when request is PAUSED', () => {
      expect(isLateAccept('PAUSED')).toBe(true)
    })

    it('returns true when request is FULFILLED', () => {
      expect(isLateAccept('FULFILLED')).toBe(true)
    })

    it('returns false when request is OPEN', () => {
      expect(isLateAccept('OPEN')).toBe(false)
    })

    it('returns false for terminal or pending states', () => {
      expect(isLateAccept('AWAITING_HOSPITAL')).toBe(false)
      expect(isLateAccept('EXPIRED')).toBe(false)
      expect(isLateAccept('CANCELLED')).toBe(false)
    })
  })
})
