from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.agent.f1_agent import ChatTurn, F1Agent
from app.api import schemas
from app.api.deps import get_agent, get_repository, get_tools
from app.db.app_db import AgentRun, Prediction, get_session
from app.db.f1_repository import F1Repository
from app.tools.f1_tools import F1Tools

router = APIRouter(prefix="/v1")

SessionDep = Annotated[Session, Depends(get_session)]


@router.post("/agent/query", response_model=schemas.AgentQueryResponse, tags=["agent"])
async def agent_query(
    body: schemas.AgentQueryRequest,
    session: SessionDep,
    agent: Annotated[F1Agent, Depends(get_agent)],
) -> schemas.AgentQueryResponse:
    history = [ChatTurn(role=t.role, content=t.content) for t in body.history]
    # El SDK de Gemini y las tools son síncronos: no bloqueamos el event loop.
    result = await run_in_threadpool(agent.run, body.message, history)

    run = AgentRun(
        conversation_id=body.conversation_id,
        query=body.message,
        answer=result.answer,
        status=result.status,
        tool_calls=[{"name": c.name, "args": c.args, "error": c.error} for c in result.tool_calls],
        consistency_suspects=result.consistency_suspects,
        model=result.model,
        latency_ms=result.latency_ms,
    )
    session.add(run)
    session.commit()

    return schemas.AgentQueryResponse(
        answer=result.answer,
        status=result.status,
        model=result.model,
        tool_calls=[schemas.ToolCallOut(name=c.name, args=c.args, error=c.error) for c in result.tool_calls],
        consistency_suspects=result.consistency_suspects,
        latency_ms=result.latency_ms,
        run_id=run.id,
    )


@router.post("/predictions", response_model=schemas.PredictionResponse, tags=["ml"])
def predict(
    body: schemas.PredictionRequest,
    session: SessionDep,
    tools: Annotated[F1Tools, Depends(get_tools)],
) -> schemas.PredictionResponse:
    outcome = tools.predictor.predict(**body.model_dump())
    if outcome.position < 0:
        raise HTTPException(status_code=503, detail="Modelo predictivo no disponible.")
    session.add(Prediction(**body.model_dump(), predicted_position=outcome.position, features=outcome.features))
    session.commit()
    return schemas.PredictionResponse(predicted_position=outcome.position, features=outcome.features)


@router.get("/drivers", response_model=list[schemas.Driver], tags=["data"])
def list_drivers(
    repo: Annotated[F1Repository, Depends(get_repository)],
    q: Annotated[str | None, Query(max_length=64)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[dict]:
    return repo.search_drivers(q, limit)


@router.get("/races/{year}/results", response_model=list[schemas.RaceResult], tags=["data"])
def race_results(
    year: int,
    repo: Annotated[F1Repository, Depends(get_repository)],
    circuit: Annotated[str | None, Query(max_length=64)] = None,
) -> list[dict]:
    return repo.query_race_results(year, circuit)
