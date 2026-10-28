"""Base de datos propia del servicio (ORM + Alembic)."""

from collections.abc import Iterator
from datetime import datetime, timezone
from functools import lru_cache

from sqlalchemy import JSON, DateTime, Engine, Float, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AgentRun(Base):
    """Traza de cada consulta procesada por el agente (observabilidad / evaluación)."""

    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    conversation_id: Mapped[str | None] = mapped_column(String(64), index=True)
    query: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32))  # ok | rejected_domain | llm_error
    tool_calls: Mapped[list] = mapped_column(JSON, default=list)
    consistency_suspects: Mapped[list] = mapped_column(JSON, default=list)
    model: Mapped[str] = mapped_column(String(128))
    latency_ms: Mapped[int] = mapped_column(Integer)


class Prediction(Base):
    """Predicciones emitidas, para compararlas después con el resultado real."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    year: Mapped[int] = mapped_column(Integer, index=True)
    circuit: Mapped[str] = mapped_column(String(128))
    driver_number: Mapped[int] = mapped_column(Integer, index=True)
    constructor: Mapped[str] = mapped_column(String(64))
    grid: Mapped[int] = mapped_column(Integer)
    predicted_position: Mapped[float] = mapped_column(Float)
    features: Mapped[dict] = mapped_column(JSON)


@lru_cache
def get_app_engine() -> Engine:
    return create_engine(get_settings().app_database_url)


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_app_engine(), expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesión por petición."""
    with _session_factory()() as session:
        yield session
