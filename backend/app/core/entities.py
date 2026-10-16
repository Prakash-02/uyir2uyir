from pydantic import Field

from app.core.models import CamelModel
from app.requests.models import BloodGroup, Lang


class Hospital(CamelModel):
    id: str
    name: str
    aliases: list[str] = Field(default_factory=list)
    centre_id: str = ""
    area: str
    city: str = "Chennai"
    active: bool = True
    is_simulated: bool = True
    data_mode: str = "demo"


class Centre(CamelModel):
    id: str
    name: str
    area: str
    city: str = "Chennai"
    active: bool = True
    is_simulated: bool = True
    data_mode: str = "demo"


class Donor(CamelModel):
    id: str
    alias: str
    blood_group: BloodGroup
    lang: Lang = Lang.EN
    area: str
    city: str = "Chennai"
    distance_km: float = 0.0
    phone_hash: str = ""
    phone_masked: str = "+91 ••••• ••000"
    consent_urgent: bool = True
    consent_history: bool = True
    adult: bool = True
    active: bool = True
    last_donation_date: str | None = None
    is_simulated: bool = True
    data_mode: str = "demo"
