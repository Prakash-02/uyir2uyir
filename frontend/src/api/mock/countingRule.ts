import type { RequestStatus } from '../types'

export interface CountingRuleInput {
  unitsNeeded: number
  accepted: number
  onTheWay: number
  currentStatus: RequestStatus
}

export interface CountingRuleResult {
  status: RequestStatus
  covered: number
  isFulfilled: boolean
  isPaused: boolean
  isOpen: boolean
}

/**
 * Pure function implementing the U2U counting rule from U2U_BRIEF.md section 3:
 *
 * N        = units needed
 * covered  = ACCEPTED + ON_THE_WAY
 * pause    when covered >= N + 1      (one spare donor)
 * reopen   when covered <  N
 * fulfil   when ACCEPTED >= N         (everyone still on the way is thanked and stood down)
 */
export function evaluateCountingRule({
  unitsNeeded,
  accepted,
  onTheWay,
  currentStatus,
}: CountingRuleInput): CountingRuleResult {
  const covered = accepted + onTheWay

  // 1. Fulfil when accepted reaches or exceeds target N
  if (accepted >= unitsNeeded) {
    return {
      status: 'FULFILLED',
      covered,
      isFulfilled: true,
      isPaused: false,
      isOpen: false,
    }
  }

  // Terminal states (CANCELLED, REJECTED, EXPIRED) do not reopen
  if (
    currentStatus === 'CANCELLED' ||
    currentStatus === 'REJECTED' ||
    currentStatus === 'EXPIRED'
  ) {
    return {
      status: currentStatus,
      covered,
      isFulfilled: false,
      isPaused: false,
      isOpen: false,
    }
  }

  // 2. Pause when covered reaches or exceeds N + 1 (one spare donor)
  if (covered >= unitsNeeded + 1) {
    return {
      status: 'PAUSED',
      covered,
      isFulfilled: false,
      isPaused: true,
      isOpen: false,
    }
  }

  // 3. Reopen when covered drops below N
  if (covered < unitsNeeded) {
    return {
      status: 'OPEN',
      covered,
      isFulfilled: false,
      isPaused: false,
      isOpen: true,
    }
  }

  // 4. In-between (covered === unitsNeeded): maintain current state
  // If request was already PAUSED, it stays PAUSED. If OPEN, it stays OPEN until N + 1.
  const maintainedStatus: RequestStatus = currentStatus === 'PAUSED' ? 'PAUSED' : 'OPEN'

  return {
    status: maintainedStatus,
    covered,
    isFulfilled: false,
    isPaused: maintainedStatus === 'PAUSED',
    isOpen: maintainedStatus === 'OPEN',
  }
}

/**
 * Returns true if a press 1 from a donor should become LATE_ACCEPT
 * ("A press 1 after PAUSED or FULFILLED becomes LATE_ACCEPT ('thank you, we have enough').")
 */
export function isLateAccept(requestStatus: RequestStatus): boolean {
  return requestStatus === 'PAUSED' || requestStatus === 'FULFILLED'
}
