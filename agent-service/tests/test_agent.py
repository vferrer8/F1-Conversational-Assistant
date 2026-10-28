"""Comportamiento del agente que no requiere llamar al LLM."""

from app.agent.f1_agent import ChatTurn, F1Agent, ToolCall
from app.guards.consistency_guard import ConsistencyGuard


def test_out_of_domain_is_rejected_without_llm():
    result = F1Agent(api_key="unused").run("What is the capital of France?")
    assert result.status == "rejected_domain"
    assert result.tool_calls == []


def test_follow_up_inherits_f1_context(monkeypatch):
    agent = F1Agent(api_key="unused")
    monkeypatch.setattr(agent, "_invoke_with_retry", lambda chat, q, **kw: ("Hamilton.", True, False))
    history = [ChatTurn("user", "¿Quién ganó en Monza 2019?"), ChatTurn("assistant", "Leclerc.")]

    assert agent.run("¿Y quién quedó segundo?", history).status == "ok"
    assert agent.run("¿Y quién quedó segundo?").status == "rejected_domain"
    off_topic = [ChatTurn("user", "Recommend me a pasta recipe"), ChatTurn("assistant", "No.")]
    assert agent.run("¿Y otra?", off_topic).status == "rejected_domain"


def test_falls_back_to_next_model_when_overloaded(monkeypatch):
    agent = F1Agent(api_key="unused", model="primary")
    agent.fallback_models = ["backup"]
    used: list[str] = []
    monkeypatch.setattr(agent, "_new_chat", lambda model, calls, history: used.append(model) or model)
    replies = {"primary": ("Saturado", False, True), "backup": ("Leclerc ganó.", True, False)}
    monkeypatch.setattr(agent, "_invoke_with_retry", lambda chat, q, **kw: replies[chat])

    result = agent.run("¿Quién ganó en Monza 2019?")

    assert used == ["primary", "backup"]
    assert result.status == "ok" and result.model == "backup"


def test_traced_tool_records_args_and_result():
    agent = F1Agent(api_key="unused")
    calls: list[ToolCall] = []
    traced = agent._traced(agent.f1_tools.get_race_results, calls)

    rows = traced(year=2019, circuit="Monza")

    assert traced.__name__ == "get_race_results"
    assert calls[0].args == {"year": 2019, "circuit": "Monza"}
    assert calls[0].result == rows and len(rows) == 20


def test_season_standings_tool_is_registered_and_returns_champion():
    agent = F1Agent(api_key="unused")
    assert "get_season_standings" in [t.__name__ for t in agent._tool_callables]

    calls: list[ToolCall] = []
    rows = agent._traced(agent.f1_tools.get_season_standings, calls)(year=2021, limit=3)

    assert [r["driver"] for r in rows] == ["Max Verstappen", "Lewis Hamilton", "Valtteri Bottas"]
    assert rows[0]["points"] == 395.5
    assert calls[0].error is None


def test_consistency_accepts_tool_args_and_query_numbers(monkeypatch):
    agent = F1Agent(api_key="unused")

    def fake_invoke(chat, query, **kw):
        # Simula que el LLM llama a la tool y redacta con el año del argumento.
        tool = agent._traced(agent.f1_tools.get_season_standings, calls_ref[0])
        tool(year=2021, limit=1)
        return "En 2021 ganó Verstappen con 395.5 puntos, no con 400.", True, False

    calls_ref: list = []
    monkeypatch.setattr(agent, "_new_chat", lambda model, calls, history: calls_ref.append(calls) or "chat")
    monkeypatch.setattr(agent, "_invoke_with_retry", fake_invoke)

    result = agent.run("¿Quién fue campeón del mundo en 2021?")
    # 2021 viene del argumento, 395.5 de la tabla; 400 es inventado.
    assert result.consistency_suspects == [400.0]


def test_traced_tool_captures_errors():
    agent = F1Agent(api_key="unused")
    calls: list[ToolCall] = []

    def get_race_results(year: int):
        raise RuntimeError("boom")

    out = agent._traced(get_race_results, calls)(year=2019)
    assert out == {"error": "boom"}
    assert calls[0].error == "boom"


def test_consistency_guard_flags_invented_numbers():
    tool_data = [[{"points": 25.0, "year": 2019}]]
    guard = ConsistencyGuard()
    assert guard.validate_consistency("Ganó en 2019 con 25 puntos.", tool_data)["valid"]
    bad = guard.validate_consistency("Ganó en 2019 con 312 puntos.", tool_data)
    assert not bad["valid"] and bad["suspect"] == [312.0]
