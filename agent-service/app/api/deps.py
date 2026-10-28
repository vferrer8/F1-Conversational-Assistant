"""Dependencias compartidas (inyectables y sustituibles en tests)."""

from functools import lru_cache

from app.agent.f1_agent import F1Agent
from app.db.f1_repository import F1Repository
from app.tools.f1_tools import F1Tools


@lru_cache
def get_tools() -> F1Tools:
    return F1Tools()


@lru_cache
def get_agent() -> F1Agent:
    return F1Agent(f1_tools=get_tools())


def get_repository() -> F1Repository:
    return get_tools().db
