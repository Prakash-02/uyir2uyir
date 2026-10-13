import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from './StatusBadge'
import type { RequestStatus, CallState } from '../api/types'
import type { DeskAnswer } from './StatusBadge'

describe('StatusBadge', () => {
  const requestStatuses: { status: RequestStatus; expectedText: string }[] = [
    { status: 'OPEN', expectedText: 'Calling donors' },
    { status: 'PAUSED', expectedText: 'Enough on the way' },
    { status: 'FULFILLED', expectedText: 'Fulfilled' },
    { status: 'AWAITING_HOSPITAL', expectedText: 'Waiting for hospital' },
    { status: 'EXPIRED', expectedText: 'Expired' },
    { status: 'CANCELLED', expectedText: 'Cancelled' },
    { status: 'REJECTED', expectedText: 'Rejected' },
  ]

  requestStatuses.forEach(({ status, expectedText }) => {
    it(`renders an icon and word for RequestStatus "${status}"`, () => {
      const { container } = render(<StatusBadge status={status} />)
      expect(screen.getByText(expectedText)).toBeInTheDocument()
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  const callStates: { status: CallState; expectedText: string }[] = [
    { status: 'QUEUED', expectedText: 'Queued' },
    { status: 'DIALING', expectedText: 'Dialing' },
    { status: 'RINGING', expectedText: 'Ringing' },
    { status: 'ON_THE_WAY', expectedText: 'On the way' },
    { status: 'ACCEPTED', expectedText: 'Accepted' },
    { status: 'DEFERRED', expectedText: 'Deferred' },
    { status: 'DECLINED', expectedText: 'Declined' },
    { status: 'NO_ANSWER', expectedText: 'No answer' },
    { status: 'UNKNOWN', expectedText: 'Unknown' },
    { status: 'OPTED_OUT', expectedText: 'Opted out' },
    { status: 'LATE_ACCEPT', expectedText: 'Thanked' },
    { status: 'CANCELLED', expectedText: 'Cancelled' },
  ]

  callStates.forEach(({ status, expectedText }) => {
    it(`renders an icon and word for CallState "${status}"`, () => {
      const { container } = render(<StatusBadge status={status} kind="call" />)
      expect(screen.getByText(expectedText)).toBeInTheDocument()
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  const deskAnswers: { status: DeskAnswer; expectedText: string }[] = [
    { status: 'VERIFIED_MATCH', expectedText: 'Verified match' },
    { status: 'SENT_TO_HOSPITAL', expectedText: 'Sent to hospital' },
    { status: 'NOT_VERIFIED', expectedText: "Couldn't verify" },
  ]

  deskAnswers.forEach(({ status, expectedText }) => {
    it(`renders an icon and word for DeskAnswer "${status}"`, () => {
      const { container } = render(<StatusBadge status={status} />)
      expect(screen.getByText(expectedText)).toBeInTheDocument()
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })
})
