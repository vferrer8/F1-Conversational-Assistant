"""Contratos HTTP del servicio (Pydantic v2)."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatTurnIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class AgentQueryRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurnIn] = Field(default_factory=list, max_length=50)
    conversation_id: str | None = Field(default=None, max_length=64)


class ToolCallOut(BaseModel):
    name: str
    args: dict[str, Any]
    error: str | None = None


class AgentQueryResponse(BaseModel):
    answer: str
    status: Literal["ok", "rejected_domain", "llm_error"]
    model: str
    tool_calls: list[ToolCallOut]
    consistency_suspects: list[float]
    latency_ms: int
    run_id: int


class PredictionRequest(BaseModel):
    year: int = Field(ge=1950, le=2100)
    circuit: str = Field(min_length=2, examples=["Autodromo Nazionale Monza"])
    driver_number: int = Field(ge=1, le=99)
    grid: int = Field(ge=1, le=30)
    constructor: str = Field(min_length=2, examples=["Ferrari"])


class PredictionResponse(BaseModel):
    predicted_position: float
    features: dict[str, float]
    warning: str = "Estimación del modelo basada en datos históricos; no garantiza el resultado real."


class Driver(BaseModel):
    driver_number: float | None
    full_name: str | None
    nationality: str | None


class RaceResult(BaseModel):
    year: int
    circuit: str
    driver_name: str | None
    driver_number: float | None
    constructor: str | None
    grid_position: int | None
    final_position: float | None
    final_position_order: int | None
    points: float | None


class DatasetStats(BaseModel):
    seasons: int
    first_season: int
    last_season: int
    races: int
    drivers: int
    constructors: int
    results: int
    lap_times: int


class Race(BaseModel):
    round: int
    name: str
    date: str | None


class StandingRow(BaseModel):
    position: int
    driver: str
    points: float
    wins: int
    constructor: str | None


class PredictorDriver(BaseModel):
    number: int
    name: str
    constructor: str


class PredictorCircuit(BaseModel):
    circuit: str
    grand_prix: str


class PredictorOptions(BaseModel):
    drivers: list[PredictorDriver]
    constructors: list[str]
    circuits: list[PredictorCircuit]
    seasons: list[int]


class Health(BaseModel):
    status: Literal["ok"]
    model_loaded: bool
    llm_model: str
