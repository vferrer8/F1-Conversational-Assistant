import os
from pathlib import Path

import pytest

# La BD del servicio de los tests va a un fichero temporal; se fija antes de
# importar `app` porque la configuración se cachea.
_TMP_DB = Path(__file__).parent / ".test_agent_service.db"
os.environ["APP_DATABASE_URL"] = f"sqlite:///{_TMP_DB.as_posix()}"
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.agent.f1_agent import AgentResult, ChatTurn, ToolCall  # noqa: E402
from app.api.deps import get_agent  # noqa: E402
from app.main import app  # noqa: E402

SERVICE_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def migrated_db():
    _TMP_DB.unlink(missing_ok=True)
    command.upgrade(Config(str(SERVICE_ROOT / "alembic.ini")), "head")
    yield
    from app.db.app_db import get_app_engine

    get_app_engine().dispose()
    _TMP_DB.unlink(missing_ok=True)


class FakeAgent:
    """Sustituye al LLM: devuelve una respuesta fija y registra lo recibido."""

    def __init__(self) -> None:
        self.received: list[tuple[str, list[ChatTurn]]] = []

    def run(self, query: str, history: list[ChatTurn] | None = None) -> AgentResult:
        self.received.append((query, history or []))
        return AgentResult(
            answer="Charles Leclerc ganó el GP de Italia 2019.",
            status="ok",
            model="fake-model",
            tool_calls=[ToolCall(name="get_race_results", args={"year": 2019, "circuit": "Monza"})],
            latency_ms=12,
        )


@pytest.fixture
def fake_agent():
    agent = FakeAgent()
    app.dependency_overrides[get_agent] = lambda: agent
    yield agent
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)
