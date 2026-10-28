# F1-GPT: A Conversational Assistant for Formula 1 Analysis and Prediction

Master's thesis (TFM) · MSc in Artificial Intelligence · UTAMED
Author: **Víctor Ferrer Teixidor** · Supervisor: **Alfons Marquès**

---

F1-GPT is a conversational assistant specialised in Formula 1. It combines LLM reasoning with structured historical data, recent telemetry and a machine-learning model that predicts race finishing positions.

The assistant answers in both Spanish and English. It adapts its answer to whether the question is descriptive, predictive or mixed, and it refuses any question outside the F1 domain.

## Architecture

The project is a small monorepo with three services:

```
┌──────────────────┐   /api    ┌──────────────────────┐  HTTP   ┌──────────────────────────────┐
│ web              │──────────▶│ chat-api             │────────▶│ agent-service                │
│ React · TS       │           │ NestJS · Prisma      │         │ FastAPI · SQLAlchemy ·       │
│ Vite · Tailwind  │           │ conversations +      │         │ Alembic · Pydantic           │
└──────────────────┘           │ messages (SQLite)    │         │ F1Agent + guardrails + tools │
                               └──────────────────────┘         └──────┬───────────────┬───────┘
                                                                       │               │
                                                       Gemini (tool calling)   Ergast SQLite · OpenF1 ·
                                                                               XGBoost · agent traces
```

| Service | Stack | Responsibility |
|---|---|---|
| [`web/`](web) | React 19, TypeScript, Vite, Tailwind CSS 4 | Project overview, assistant chat (with a saved demo conversation), data explorer (standings, calendar, race results) and predictor. Only the chat needs the LLM |
| [`chat-api/`](chat-api) | NestJS 12, Prisma 7 (SQLite) | Stores conversations and messages, sends the history to the agent, and exposes F1 data and predictions to the web (`/api/f1/*`) |
| [`agent-service/`](agent-service) | FastAPI, SQLAlchemy 2, Alembic, Pydantic 2 | The F1 agent: LLM, tools, guardrails, ML model; logs every run and prediction |

The agent tries `gemini-flash-lite-latest` first and falls back to `gemini-flash-latest` when a model is overloaded (503/504). Both are configurable (`GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`).

The agent is **stateless**: each request carries the conversation history, so a single instance serves every user without mixing conversations. Inside the agent service, the original layers are unchanged:

**Semantic layer.** The system prompt embeds the entity mappings (drivers, circuits, constructors) and the tool-selection rules. The LLM never writes SQL or calls the API directly. It always delegates to the tools.

**Tool calling.** The Gemini SDK manages the full invocation cycle. Each tool is wrapped per request so the agent records which tools were called, with which arguments and what they returned. Four tools are available:

| Tool | Data source | Purpose |
|---|---|---|
| `get_driver_standings` | SQLite (Ergast 1950–2024) | Driver profile and basic data |
| `get_race_results` | SQLite (Ergast 1950–2024) | Official results of a Grand Prix |
| `get_telemetry` | OpenF1 API (2023+) | Lap times and recent telemetry |
| `predict_position` | XGBoost model | Estimated final race position |

**Guardrails.** Three chained filters share the same interface, `{"valid": bool, "message": str}`:

| Guardrail | When | What it does |
|---|---|---|
| `DomainGuard` | Before inference | Filters out non-F1 questions with a bilingual (ES/EN) lexical allowlist. A follow-up ("and who came second?") inherits the F1 context of the previous question |
| `ToolValidator` | Before and during execution | Only allowlisted tools are registered, and every call is checked again when the LLM invokes it |
| `ConsistencyGuard` | After generation | Flags numbers in the answer that do not appear in the data returned by the tools in that request |

**Databases.**

| Database | Access | Managed by |
|---|---|---|
| `agent-service/data/f1_assistant.db` | Read-only, SQLAlchemy Core | Versioned Ergast dump |
| `agent-service/data/agent_service.db` | SQLAlchemy ORM (`agent_runs`, `predictions`) | Alembic |
| `chat-api/data/chat.db` | Prisma (`Conversation`, `Message`) | Prisma Migrate |

## Predictive model

The prediction module uses an **XGBoost** model trained on the Ergast history (1950–2024, about 25,000 rows). Hyperparameters were tuned with `RandomizedSearchCV` (60 iterations × 5 folds). The model predicts a driver's finishing position from ten pre-race features:

| Feature | Description |
|---|---|
| `grid` | Starting position |
| `year` | Season |
| `season_progress` | Current round / total rounds |
| `circuit_alt` | Circuit altitude (m) |
| `driver_age` | Driver's age on race day |
| `driver_experience` | Grands Prix started up to that race |
| `avg_finish_last3` | Average finishing position over the last 3 races |
| `driver_pos_before` | Championship position before the race |
| `driver_wins_before` | Wins so far in the season |
| `constructor_pos_before` | Constructor's championship position before the race |

Features that cannot be read from the database (future races, or drivers with no history) are imputed with the dataset median. The output is clipped to the range [1, 25] and always comes with a note on the model's limitations. Every prediction is stored in the `predictions` table, so it can be compared with the real result later.

## Evaluation

The benchmark (`agent-service/evaluation/benchmark.json`) holds 20 reference questions in four categories:

- **descriptive**: historical results and driver profiles
- **predictive**: estimates of future positions
- **comparative**: comparisons across seasons or drivers
- **out_of_domain**: non-F1 questions, which must be refused

`agent-service/evaluate.py` measures the task completion rate (overall and per category), end-to-end latency (mean, p50, p90) and the estimated cost per query. Every query that goes through the API is also traced in the `agent_runs` table (tools called, guardrail result, latency, model).

## Project structure

```
├── docker-compose.yml        # Whole stack locally
├── cloudbuild.yaml           # Google Cloud deployment (Cloud Build → Cloud Run)
├── .github/workflows/ci.yml  # Tests and builds for the three services
├── web/                      # React + TypeScript + Vite + Tailwind
│   └── src/                  # App.tsx, api.ts, components/
├── chat-api/                 # NestJS + Prisma
│   ├── prisma/               # schema.prisma + migrations
│   ├── src/conversations/    # REST API for conversations and messages
│   ├── src/agent/            # HTTP client for agent-service
│   └── test/                 # Vitest + Supertest
└── agent-service/            # FastAPI + SQLAlchemy + Alembic + Pydantic
    ├── app/
    │   ├── main.py           # FastAPI app (interactive docs at /docs)
    │   ├── api/              # Routes, Pydantic schemas, dependencies
    │   ├── core/config.py    # Settings (pydantic-settings)
    │   ├── db/               # Ergast tables, ORM models, repository
    │   ├── agent/f1_agent.py # Orchestrator: LLM + tool calling + guardrails
    │   ├── guards/           # Domain, tool and consistency guardrails
    │   ├── ml/               # XGBoost inference + feature resolution
    │   ├── clients/openf1.py # OpenF1 client (telemetry 2023+)
    │   └── tools/f1_tools.py # Functions exposed to the LLM
    ├── alembic/              # Migrations for agent_service.db
    ├── tests/                # pytest
    ├── data/                 # Ergast SQLite dump + training dataset
    ├── models/               # race_pos_model.pkl
    ├── notebooks/            # Model development and LR / RF / XGBoost comparison
    ├── evaluation/           # Benchmark (20 questions)
    ├── train_xgboost_tfm.py
    └── evaluate.py
```

## Getting started

Requirements: Python 3.12, Node.js 24 and a Gemini API key.

```bash
cp .env.example .env                 # then set GEMINI_API_KEY

# 1. Agent service → http://localhost:8000/docs
cd agent-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 2. Chat API → http://localhost:3000/api
cd chat-api
cp .env.example .env
npm install
npx prisma migrate deploy && npx prisma generate
npm run start:dev

# 3. Web → http://localhost:5173
cd web
npm install
npm run dev
```

With Docker, `docker compose up --build` starts the three services at http://localhost:8080.

Tests: `pytest` in `agent-service`, `npm test` in `chat-api`, `npm run build` in `web`. CI runs all three on every push.

Training and evaluation (from `agent-service/`):

```bash
python train_xgboost_tfm.py      # trains and saves models/race_pos_model.pkl
python evaluate.py --limit 5     # runs part of the benchmark
```

## Deploying to Google Cloud

`cloudbuild.yaml` builds the three images, pushes them to Artifact Registry and deploys them to Cloud Run. It is not run automatically, because it needs a GCP project with billing enabled.

- **Secret Manager** stores `GEMINI_API_KEY`. Cloud Run injects it as an environment variable, so the code needs no GCP SDK.
- **Cloud Storage** (optional, `_ARTIFACTS_BUCKET`) holds the trained model, so binaries do not have to live in git.
- **Cloud Build** runs the pipeline. The agent is deployed as a private service, and the Chat API calls it with an identity token from the metadata server.

Before using it in production, move the SQLite databases to Cloud SQL (Postgres), because Cloud Run's filesystem is ephemeral. With SQLAlchemy and Prisma this means changing the connection URL and the Prisma adapter.

## Data sources

- **Ergast Motor Racing Data**: historical results dump for 1950–2024, stored in a local SQLite database (`agent-service/data/f1_assistant.db`).
- **OpenF1 API**: telemetry and lap times for sessions from 2023 onwards. It is queried live only when the user asks for recent telemetry.

## Known limitations

- The semantic layer lives in the system prompt. Drivers or circuits missing from the entity maps can cause resolution errors.
- `ConsistencyGuard` compares raw numbers. If the LLM turns a value into a percentage (for example `season_progress` 0.666 → 66.6 %), the guardrail flags it as a false positive.
- The Ergast data stops at 2024, so predictions for later seasons rely mostly on median-imputed features.
- `race_pos_model.pkl` was pickled with an older XGBoost version. Re-run `train_xgboost_tfm.py` to remove the load warning.
- The OpenF1 client only implements `get_laps`. Other endpoints (sectors, intervals, weather) are not implemented.

## License

Academic use only, non-commercial. Historical data courtesy of the public Ergast dumps and the OpenF1 API.
