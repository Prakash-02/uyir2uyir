import pytest

from app.requests.counting import (
    TERMINAL_STATUSES,
    covered,
    next_status,
)
from app.requests.models import RequestStatus


def test_covered_calculation() -> None:
    assert covered(0, 0) == 0
    assert covered(1, 2) == 3
    assert covered(2, 0) == 2


@pytest.mark.parametrize(
    "current_status, units_needed, accepted, on_the_way, expected_status",
    [
        # --- N = 2 Standard Lifecycle ---
        # Initial: covered = 0 < 2 -> stays OPEN
        (RequestStatus.OPEN, 2, 0, 0, RequestStatus.OPEN),
        # 1 donor on the way: covered = 1 < 2 -> stays OPEN
        (RequestStatus.OPEN, 2, 0, 1, RequestStatus.OPEN),
        # 2 donors on the way (gap zone: N <= covered < N+1): stays OPEN
        (RequestStatus.OPEN, 2, 0, 2, RequestStatus.OPEN),
        # 3 donors on the way: covered = 3 >= N+1 -> PAUSED
        (RequestStatus.OPEN, 2, 0, 3, RequestStatus.PAUSED),
        # 4 donors on the way: covered = 4 >= N+1 -> PAUSED
        (RequestStatus.OPEN, 2, 0, 4, RequestStatus.PAUSED),
        # Already PAUSED, covered remains 3: stays PAUSED
        (RequestStatus.PAUSED, 2, 0, 3, RequestStatus.PAUSED),
        # Staff accepts 1, defer 1: accepted=1, otw=1 -> covered=2 (gap zone): stays PAUSED
        (RequestStatus.PAUSED, 2, 1, 1, RequestStatus.PAUSED),
        # 1 donor cancels: accepted=1, otw=0 -> covered=1 < N -> REOPENS to OPEN
        (RequestStatus.PAUSED, 2, 1, 0, RequestStatus.OPEN),
        # Round 2: 1 donor arrives: accepted=1, otw=1 -> covered=2 (gap zone): stays OPEN
        (RequestStatus.OPEN, 2, 1, 1, RequestStatus.OPEN),
        # Staff accepts 2nd donor: accepted=2 >= N -> FULFILLED
        (RequestStatus.OPEN, 2, 2, 0, RequestStatus.FULFILLED),
        # Over-accepted: accepted=3 >= N -> FULFILLED
        (RequestStatus.OPEN, 2, 3, 0, RequestStatus.FULFILLED),
        (RequestStatus.PAUSED, 2, 2, 1, RequestStatus.FULFILLED),
        # --- N = 1 Single Unit Edge Case ---
        # N=1, covered=0 -> OPEN
        (RequestStatus.OPEN, 1, 0, 0, RequestStatus.OPEN),
        # N=1, covered=1 (gap zone: 1 <= cov < 2) -> stays OPEN
        (RequestStatus.OPEN, 1, 0, 1, RequestStatus.OPEN),
        # N=1, covered=2 (>= N+1) -> PAUSED
        (RequestStatus.OPEN, 1, 0, 2, RequestStatus.PAUSED),
        # N=1, accepted=1 -> FULFILLED
        (RequestStatus.OPEN, 1, 1, 0, RequestStatus.FULFILLED),
        (RequestStatus.PAUSED, 1, 1, 1, RequestStatus.FULFILLED),
        # --- N = 4 Multi-unit Scenario ---
        (RequestStatus.OPEN, 4, 0, 3, RequestStatus.OPEN),
        (RequestStatus.OPEN, 4, 0, 4, RequestStatus.OPEN),  # gap zone: 4 <= cov < 5
        (RequestStatus.OPEN, 4, 0, 5, RequestStatus.PAUSED),  # 5 >= 4+1
        (RequestStatus.PAUSED, 4, 2, 2, RequestStatus.PAUSED),  # gap zone: cov=4
        (RequestStatus.PAUSED, 4, 2, 1, RequestStatus.OPEN),  # cov=3 < 4 -> REOPENS
        (RequestStatus.OPEN, 4, 4, 0, RequestStatus.FULFILLED),
    ],
)
def test_next_status_counting_table(
    current_status: RequestStatus,
    units_needed: int,
    accepted: int,
    on_the_way: int,
    expected_status: RequestStatus,
) -> None:
    """Every row of the counting rule: pause at N+1, reopen below N, fulfil at accepted >= N."""
    assert (
        next_status(
            status=current_status,
            units_needed=units_needed,
            accepted=accepted,
            on_the_way=on_the_way,
        )
        == expected_status
    )


@pytest.mark.parametrize("terminal", list(TERMINAL_STATUSES))
@pytest.mark.parametrize(
    "units, accepted, on_the_way",
    [
        (2, 0, 0),
        (2, 3, 5),
        (1, 1, 0),
        (4, 0, 10),
    ],
)
def test_terminal_states_never_change(
    terminal: RequestStatus, units: int, accepted: int, on_the_way: int
) -> None:
    """Terminal states (FULFILLED, EXPIRED, CANCELLED, REJECTED) never transition."""
    assert (
        next_status(
            status=terminal,
            units_needed=units,
            accepted=accepted,
            on_the_way=on_the_way,
        )
        == terminal
    )
