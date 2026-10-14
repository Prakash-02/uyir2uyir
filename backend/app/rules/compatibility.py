"""Blood group compatibility rules per component.

STATUS: DEMO_UNAPPROVED
Note: This table is a demonstration reference implementation.
to be replaced by the blood centre's approved table upon clinical deployment.
"""

from app.requests.models import BloodGroup, Component

# STATUS: DEMO_UNAPPROVED
STATUS = "DEMO_UNAPPROVED"

# Red Cells (PRBC) and Whole Blood compatibility:
# Maps recipient BloodGroup -> set of compatible donor BloodGroups
# (O- is universal red cell donor; AB+ is universal red cell recipient)
RED_CELLS_COMPATIBILITY: dict[BloodGroup, frozenset[BloodGroup]] = {
    BloodGroup.O_NEG: frozenset({BloodGroup.O_NEG}),
    BloodGroup.O_POS: frozenset({BloodGroup.O_NEG, BloodGroup.O_POS}),
    BloodGroup.A_NEG: frozenset({BloodGroup.O_NEG, BloodGroup.A_NEG}),
    BloodGroup.A_POS: frozenset(
        {
            BloodGroup.O_NEG,
            BloodGroup.O_POS,
            BloodGroup.A_NEG,
            BloodGroup.A_POS,
        }
    ),
    BloodGroup.B_NEG: frozenset({BloodGroup.O_NEG, BloodGroup.B_NEG}),
    BloodGroup.B_POS: frozenset(
        {
            BloodGroup.O_NEG,
            BloodGroup.O_POS,
            BloodGroup.B_NEG,
            BloodGroup.B_POS,
        }
    ),
    BloodGroup.AB_NEG: frozenset(
        {
            BloodGroup.O_NEG,
            BloodGroup.A_NEG,
            BloodGroup.B_NEG,
            BloodGroup.AB_NEG,
        }
    ),
    BloodGroup.AB_POS: frozenset(
        {
            BloodGroup.O_NEG,
            BloodGroup.O_POS,
            BloodGroup.A_NEG,
            BloodGroup.A_POS,
            BloodGroup.B_NEG,
            BloodGroup.B_POS,
            BloodGroup.AB_NEG,
            BloodGroup.AB_POS,
        }
    ),
}

# Plasma (FFP) compatibility (reversed antibodies):
# Maps recipient BloodGroup -> set of compatible donor BloodGroups
# (AB is universal plasma donor; O is universal plasma recipient)
PLASMA_COMPATIBILITY: dict[BloodGroup, frozenset[BloodGroup]] = {
    BloodGroup.AB_POS: frozenset({BloodGroup.AB_POS, BloodGroup.AB_NEG}),
    BloodGroup.AB_NEG: frozenset({BloodGroup.AB_POS, BloodGroup.AB_NEG}),
    BloodGroup.A_POS: frozenset(
        {
            BloodGroup.A_POS,
            BloodGroup.A_NEG,
            BloodGroup.AB_POS,
            BloodGroup.AB_NEG,
        }
    ),
    BloodGroup.A_NEG: frozenset(
        {
            BloodGroup.A_POS,
            BloodGroup.A_NEG,
            BloodGroup.AB_POS,
            BloodGroup.AB_NEG,
        }
    ),
    BloodGroup.B_POS: frozenset(
        {
            BloodGroup.B_POS,
            BloodGroup.B_NEG,
            BloodGroup.AB_POS,
            BloodGroup.AB_NEG,
        }
    ),
    BloodGroup.B_NEG: frozenset(
        {
            BloodGroup.B_POS,
            BloodGroup.B_NEG,
            BloodGroup.AB_POS,
            BloodGroup.AB_NEG,
        }
    ),
    BloodGroup.O_POS: frozenset(
        {
            BloodGroup.O_POS,
            BloodGroup.O_NEG,
            BloodGroup.A_POS,
            BloodGroup.A_NEG,
            BloodGroup.B_POS,
            BloodGroup.B_NEG,
            BloodGroup.AB_POS,
            BloodGroup.AB_NEG,
        }
    ),
    BloodGroup.O_NEG: frozenset(
        {
            BloodGroup.O_POS,
            BloodGroup.O_NEG,
            BloodGroup.A_POS,
            BloodGroup.A_NEG,
            BloodGroup.B_POS,
            BloodGroup.B_NEG,
            BloodGroup.AB_POS,
            BloodGroup.AB_NEG,
        }
    ),
}


def compatible_donor_groups(
    patient_group: BloodGroup, component: Component
) -> frozenset[BloodGroup]:
    """Returns the set of compatible donor blood groups for a patient and blood component.

    STATUS: DEMO_UNAPPROVED
    to be replaced by the blood centre's approved table.
    """
    if component == Component.PLASMA:
        return PLASMA_COMPATIBILITY.get(patient_group, frozenset({patient_group}))

    # RED_CELLS, WHOLE_BLOOD, PLATELETS, UNSPECIFIED default to RBC compatibility
    return RED_CELLS_COMPATIBILITY.get(patient_group, frozenset({patient_group}))


def is_compatible(donor_group: BloodGroup, patient_group: BloodGroup, component: Component) -> bool:
    """Evaluates whether a donor blood group is clinically compatible with a patient's need.

    STATUS: DEMO_UNAPPROVED
    to be replaced by the blood centre's approved table.
    """
    return donor_group in compatible_donor_groups(patient_group, component)
