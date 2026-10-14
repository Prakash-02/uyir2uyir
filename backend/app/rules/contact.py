"""Donor contact eligibility and deferral interval rules.

STATUS: DEMO_UNAPPROVED
Note: This rule implements the standard voluntary donation spacing interval.
to be replaced by the blood centre's approved table.
"""

from datetime import date, timedelta

# STATUS: DEMO_UNAPPROVED
STATUS = "DEMO_UNAPPROVED"

DEFAULT_MIN_DONATION_INTERVAL_DAYS = 90  # 3 months standard clinical deferral interval


def next_contact_date(
    last_donation_date: date,
    interval_days: int = DEFAULT_MIN_DONATION_INTERVAL_DAYS,
) -> date:
    """Calculates the earliest date a donor may be contacted for another donation.

    STATUS: DEMO_UNAPPROVED
    """
    return last_donation_date + timedelta(days=interval_days)


def is_eligible_for_contact(
    last_donation_date: date | None,
    current_date: date,
    opted_out: bool = False,
    interval_days: int = DEFAULT_MIN_DONATION_INTERVAL_DAYS,
) -> bool:
    """Evaluates whether 'next contact date has passed' and donor has not opted out.

    STATUS: DEMO_UNAPPROVED
    to be replaced by the blood centre's approved table.

    Rules:
    - If donor has opted out (consent withdrawn via Press 9), returns False immediately.
    - If donor has no previous donation recorded (None), returns True.
    - Returns True if current_date >= next_contact_date.
    """
    if opted_out:
        return False

    if last_donation_date is None:
        return True

    return current_date >= next_contact_date(last_donation_date, interval_days)
