"""Servicio de agente F1-GPT (FastAPI).

Arranque local:  uvicorn app.main:app --reload --port 8000
Docs interactivas: http://localhost:8000/docs
"""

import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import get_tools
from app.api.routes import router
from app.api.schemas import Health
from app.core.config import get_settings
from app.tools.f1_tools import F1Tools

logging.basicConfig(level=logging.INFO)

settings = get_settings()

app = FastAPI(
    title="F1-GPT Agent Service",
    version="0.2.0",
    description="Agente conversacional de F1: tool calling sobre Gemini, guardarraíles y predicción XGBoost.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/health", response_model=Health, tags=["ops"])
def health(tools: F1Tools = Depends(get_tools)) -> Health:
    return Health(status="ok", model_loaded=tools.predictor.model is not None, llm_model=settings.gemini_model)
