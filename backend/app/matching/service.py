from datetime import date

from app.clock.service import Clock, get_clock
from app.core.entities import Donor
from app.core.store import Store
from app.requests.models import BloodRequest
from app.rules.compatibility import is_compatible
from app.rules.contact import is_eligible_for_contact


async def select_donors_for_request(
    store: Store,
    request: BloodRequest,
    clock: Clock | None = None,
    limit: int = 5,
) -> list[Donor]:
    """Selects eligible, compatible donors for a blood request deterministically.

    Rules applied:
    - Clinically compatible blood group for request's component.
    - Explicit consent to urgent contact (consent_urgent is True).
    - Next contact date has passed (>= 90 days since last donation).
    - Donor has not opted out (active is True).
    - Donor has not already been called for this blood request in any round.
    - Deterministic order: distance_km ascending, then longest since last contacted, then donor.id.
    - Takes at most `limit` (default 5) donors. Zero randomness.
    """
    current_clock = clock or get_clock()
    current_date: date = current_clock.now().date()

    all_donors = await store.list_donors()
    existing_calls = await store.list_calls(request.id)

    called_donor_ids: set[str] = set()
    called_donor_aliases: set[str] = set()

    for call in existing_calls:
        called_donor_aliases.add(call.donor_alias)
        # Call IDs format: f"{requestId}_{round}_{donorId}"
        parts = call.id.split("_", 2)
        if len(parts) >= 3:
            called_donor_ids.add(parts[2])

    eligible_donors: list[Donor] = []

    for donor in all_donors:
        # 1. Active & not opted out
        if not donor.active or not donor.adult:
            continue

        # 2. Urgent contact consent
        if not donor.consent_urgent:
            continue

        # 3. Not already called for this blood request
        if donor.id in called_donor_ids or donor.alias in called_donor_aliases:
            continue

        # 4. Clinical blood compatibility
        if not is_compatible(donor.blood_group, request.blood_group, request.component):
            continue

        # 5. Spacing check: next contact date has passed
        last_donation: date | None = None
        if donor.last_donation_date:
            try:
                last_donation = date.fromisoformat(donor.last_donation_date[:10])
            except ValueError:
                last_donation = None

        if not is_eligible_for_contact(last_donation, current_date, opted_out=False):
            continue

        eligible_donors.append(donor)

    # Deterministic sort:
    # 1. Distance (ascending - closer first)
    # 2. Longest since last contacted (ascending - "0000-00-00" / oldest date first)
    # 3. Donor ID (ascending - strict tie-breaker)
    eligible_donors.sort(
        key=lambda d: (
            d.distance_km,
            d.last_donation_date or "0000-00-00",
            d.id,
        )
    )

    return eligible_donors[:limit]
