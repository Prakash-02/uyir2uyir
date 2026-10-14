from datetime import date, timedelta

from app.requests.models import BloodGroup, Component
from app.rules.compatibility import (
    STATUS as COMPATIBILITY_STATUS,
)
from app.rules.compatibility import (
    compatible_donor_groups,
    is_compatible,
)
from app.rules.contact import (
    DEFAULT_MIN_DONATION_INTERVAL_DAYS,
    is_eligible_for_contact,
    next_contact_date,
)
from app.rules.contact import (
    STATUS as CONTACT_STATUS,
)


def test_rules_status_is_demo_unapproved() -> None:
    """Both rules files must carry DEMO_UNAPPROVED status."""
    assert COMPATIBILITY_STATUS == "DEMO_UNAPPROVED"
    assert CONTACT_STATUS == "DEMO_UNAPPROVED"


def test_red_cells_o_neg_is_universal_donor() -> None:
    """O- donor red cells are clinically compatible with all patient groups."""
    for patient_group in BloodGroup:
        assert is_compatible(BloodGroup.O_NEG, patient_group, Component.RED_CELLS)


def test_red_cells_ab_pos_is_universal_recipient() -> None:
    """AB+ recipient can receive red cells from every donor group."""
    compatible = compatible_donor_groups(BloodGroup.AB_POS, Component.RED_CELLS)
    assert compatible == set(BloodGroup)


def test_red_cells_incompatible_cases() -> None:
    """Incompatible red cell pairings must return False."""
    # Rh incompatible: Rh+ cannot donate red cells to Rh-
    assert not is_compatible(BloodGroup.O_POS, BloodGroup.O_NEG, Component.RED_CELLS)
    assert not is_compatible(BloodGroup.A_POS, BloodGroup.A_NEG, Component.RED_CELLS)

    # ABO incompatible
    assert not is_compatible(BloodGroup.A_POS, BloodGroup.B_POS, Component.RED_CELLS)
    assert not is_compatible(BloodGroup.B_NEG, BloodGroup.A_POS, Component.RED_CELLS)
    assert not is_compatible(BloodGroup.AB_POS, BloodGroup.O_POS, Component.RED_CELLS)


def test_plasma_ab_is_universal_donor() -> None:
    """AB donor is universal plasma donor (antibodies absent)."""
    for patient_group in BloodGroup:
        assert is_compatible(BloodGroup.AB_POS, patient_group, Component.PLASMA)
        assert is_compatible(BloodGroup.AB_NEG, patient_group, Component.PLASMA)


def test_plasma_o_is_universal_recipient() -> None:
    """O patient can receive plasma from any group."""
    compatible_o_pos = compatible_donor_groups(BloodGroup.O_POS, Component.PLASMA)
    assert compatible_o_pos == set(BloodGroup)


def test_contact_date_calculation() -> None:
    """Standard 90-day interval calculation."""
    last_donated = date(2026, 1, 1)
    expected = last_donated + timedelta(days=DEFAULT_MIN_DONATION_INTERVAL_DAYS)
    assert next_contact_date(last_donated) == expected


def test_contact_eligibility_scenarios() -> None:
    """Contact rule 'next contact date has passed' and consent status."""
    today = date(2026, 5, 1)
    ninety_days_ago = today - timedelta(days=90)
    eighty_days_ago = today - timedelta(days=80)
    hundred_days_ago = today - timedelta(days=100)

    # Never donated before (None) -> eligible
    assert is_eligible_for_contact(None, today, opted_out=False) is True

    # Opted out (press 9) -> never eligible under any circumstance
    assert is_eligible_for_contact(None, today, opted_out=True) is False
    assert is_eligible_for_contact(hundred_days_ago, today, opted_out=True) is False

    # Interval passed (100 days ago >= 90) -> eligible
    assert is_eligible_for_contact(hundred_days_ago, today, opted_out=False) is True

    # Exactly 90 days ago -> eligible
    assert is_eligible_for_contact(ninety_days_ago, today, opted_out=False) is True

    # Too soon (80 days ago < 90) -> not eligible
    assert is_eligible_for_contact(eighty_days_ago, today, opted_out=False) is False
