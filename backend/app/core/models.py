from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base Pydantic model that automatically converts snake_case Python attributes

    to camelCase in serialized JSON and Firestore dict representations, matching
    docs/API_CONTRACT.md and frontend TypeScript interfaces.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
