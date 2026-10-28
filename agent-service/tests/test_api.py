from sqlalchemy import select

from app.db.app_db import AgentRun, Prediction, _session_factory


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["model_loaded"] is True


def test_search_drivers(client):
    r = client.get("/v1/drivers", params={"q": "hamilton"})
    assert r.status_code == 200
    assert any("Hamilton" in d["full_name"] for d in r.json())


def test_race_results_accepts_circuit_name(client):
    # El system prompt usa nombres de circuito; la BD guarda nombres de GP.
    r = client.get("/v1/races/2019/results", params={"circuit": "Autodromo Nazionale Monza"})
    assert r.status_code == 200
    winner = next(row for row in r.json() if row["final_position_order"] == 1)
    assert "Leclerc" in winner["driver_name"]
    assert winner["circuit"] == "Italian Grand Prix"


def test_prediction_is_logged(client):
    body = {"year": 2024, "circuit": "Autodromo Nazionale Monza", "driver_number": 16, "grid": 1, "constructor": "Ferrari"}
    r = client.post("/v1/predictions", json=body)
    assert r.status_code == 200
    data = r.json()
    assert 1 <= data["predicted_position"] <= 25
    assert set(data["features"]) >= {"grid", "driver_pos_before", "season_progress"}

    with _session_factory()() as s:
        row = s.scalars(select(Prediction).order_by(Prediction.id.desc())).first()
    assert row.driver_number == 16 and row.predicted_position == data["predicted_position"]


def test_season_data(client):
    stats = client.get("/v1/stats").json()
    assert stats["seasons"] == 75 and stats["last_season"] == 2024

    races = client.get("/v1/seasons/2019/races").json()
    assert len(races) == 21 and races[0]["name"] == "Australian Grand Prix"

    standings = client.get("/v1/seasons/2021/standings", params={"limit": 2}).json()
    assert [s["driver"] for s in standings] == ["Max Verstappen", "Lewis Hamilton"]
    assert standings[0]["constructor"] == "Red Bull"


def test_prediction_options_resolve_against_the_database(client):
    from app.ml.feature_resolver import FeatureResolver

    options = client.get("/v1/predictions/options").json()
    assert {"number": 4, "name": "Lando Norris", "constructor": "McLaren"} in options["drivers"]

    # Cada equipo del catálogo debe existir en la BD (si no, la feature cae a la mediana).
    resolver = FeatureResolver()
    with resolver.engine.connect() as conn:
        for team in options["constructors"]:
            assert resolver._get_constructor_id(conn, team) is not None, team
        # El #4 actual es Norris, no Max Chilton.
        assert resolver._get_driver_id(conn, 4) == 846


def test_prediction_validation(client):
    r = client.post("/v1/predictions", json={"year": 2024, "circuit": "Monza", "driver_number": 16, "grid": 0, "constructor": "Ferrari"})
    assert r.status_code == 422


def test_agent_query_passes_history_and_persists_run(client, fake_agent):
    body = {
        "message": "¿Y quién quedó segundo?",
        "history": [
            {"role": "user", "content": "¿Quién ganó en Monza 2019?"},
            {"role": "assistant", "content": "Leclerc."},
        ],
        "conversation_id": "conv-123",
    }
    r = client.post("/v1/agent/query", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["tool_calls"][0]["name"] == "get_race_results"

    query, history = fake_agent.received[0]
    assert query == "¿Y quién quedó segundo?"
    assert [t.role for t in history] == ["user", "assistant"]

    with _session_factory()() as s:
        run = s.get(AgentRun, data["run_id"])
    assert run.conversation_id == "conv-123"
    assert run.tool_calls[0]["args"]["year"] == 2019
