"""Pure counting and state evaluation rules for blood requests.

The backend owns these rules; the frontend mock client strictly imitates them.
Rules from U2U_BRIEF.md Section 3:
  N        = units needed
  covered  = ACCEPTED + ON_THE_WAY
  pause    when covered >= N + 1      (one spare donor)
  reopen   when covered <  N
  fulfil   when ACCEPTED >= N         (everyone still on the way is thanked and stood down)

Terminal states (FULFILLED, EXPIRED, CANCELLED, REJECTED) never change.

Worked Example for N = 2 units needed:
--------------------------------------
Thresholds:
  - pause threshold: covered >= 2 + 1 = 3
  - reopen threshold: covered < 2
  - fulfillment threshold: accepted >= 2

Step-by-step state progression:
1. Hospital raises request:
   accepted = 0, on_the_way = 0 -> covered = 0.
   Status: OPEN.
2. Donors A, B, and C press 1:
   accepted = 0, on_the_way = 3 -> covered = 3 (>= 3).
   Status transitions: OPEN -> PAUSED.
3. Donors D and E press 1 late:
   Request is already PAUSED. Calls become LATE_ACCEPT.
   Counters remain accepted = 0, on_the_way = 3. Status remains: PAUSED.
4. Staff accept donor A and defer donor B:
   accepted = 1, on_the_way = 1 (donor C) -> covered = 2 (2 <= covered < 3).
   Status remains: PAUSED.
5. Donor C cancels on the way (reminder press 2):
   accepted = 1, on_the_way = 0 -> covered = 1 (< 2).
   Status transitions: PAUSED -> OPEN (Reopened for next round).
6. Donor F presses 1:
   accepted = 1, on_the_way = 1 -> covered = 2.
   Status remains: OPEN.
7. Staff accept donor F:
   accepted = 2, on_the_way = 0 -> accepted >= 2.
   Status transitions: OPEN -> FULFILLED.
   All remaining ringing calls are cancelled, and donors are thanked.
"""

from app.requests.models import RequestStatus

TERMINAL_STATUSES: frozenset[RequestStatus] = frozenset(
    {
        RequestStatus.FULFILLED,
        RequestStatus.EXPIRED,
        RequestStatus.CANCELLED,
        RequestStatus.REJECTED,
    }
)


def covered(accepted: int, on_the_way: int) -> int:
    """Calculates total committed donor coverage: accepted + on_the_way."""
    return accepted + on_the_way


def next_status(
    status: RequestStatus,
    units_needed: int,
    accepted: int,
    on_the_way: int,
) -> RequestStatus:
    """Evaluates the deterministic next RequestStatus given current counters.

    Rules:
    - Terminal states (FULFILLED, EXPIRED, CANCELLED, REJECTED) never change.
    - Fulfil: when accepted >= units_needed.
    - Pause: when covered >= units_needed + 1.
    - Reopen: when covered < units_needed (transitions PAUSED -> OPEN).
    - Stable: when units_needed <= covered < units_needed + 1, current status is retained.
    """
    if status in TERMINAL_STATUSES:
        return status

    if accepted >= units_needed:
        return RequestStatus.FULFILLED

    cov = covered(accepted, on_the_way)

    if cov >= units_needed + 1:
        return RequestStatus.PAUSED

    if cov < units_needed:
        if status == RequestStatus.PAUSED:
            return RequestStatus.OPEN
        return status

    # units_needed <= cov < units_needed + 1
    return status
