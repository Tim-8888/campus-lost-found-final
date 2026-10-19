from pydantic import BaseModel


class ReferenceItem(BaseModel):
    id: int
    name: str
