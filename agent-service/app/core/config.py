"""Configuración del servicio de agente.

Todos los valores se leen de variables de entorno (o de un `.env`), con
pydantic-settings validando tipos. En Cloud Run los secretos llegan como
variables de entorno inyectadas desde Secret Manager, así que el código no
necesita conocer GCP.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(SERVICE_ROOT.parent / ".env", SERVICE_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = ""
    gemini_model: str = "models/gemini-flash-latest"
    llm_timeout_s: int = 40

    # Datos históricos Ergast (solo lectura).
    f1_database_url: str = f"sqlite:///{(SERVICE_ROOT / 'data' / 'f1_assistant.db').as_posix()}"
    # BD propia del servicio (trazas del agente, predicciones). Gestionada con Alembic.
    app_database_url: str = f"sqlite:///{(SERVICE_ROOT / 'data' / 'agent_service.db').as_posix()}"

    dataset_path: Path = SERVICE_ROOT / "data" / "f1_dataset_v2.csv"
    model_path: Path = SERVICE_ROOT / "models" / "race_pos_model.pkl"

    openf1_base_url: str = "https://api.openf1.org/v1"
    http_timeout_s: float = 15.0

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
