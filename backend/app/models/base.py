from sqlmodel import SQLModel, Field
from typing import Optional

# Exemple de modèle simple pour tester la création de table
class HealthCheck(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    status: str