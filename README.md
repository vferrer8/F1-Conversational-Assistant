# F1-GPT: A Conversational Assistant for Formula 1 Analysis and Prediction

Master's thesis (TFM) · MSc in Artificial Intelligence · UTAMED
Author: **Víctor Ferrer Teixidor** · Supervisor: **Alfons Marquès**

---

F1-GPT is a conversational assistant specialised in Formula 1. It combines LLM reasoning with structured historical data, recent telemetry and a machine-learning model that predicts race finishing positions.

The assistant answers in both Spanish and English. It adapts its answer to whether the question is descriptive, predictive or mixed, and it refuses any question outside the F1 domain.

## Architecture

The agent orchestrates four layers:

```
┌──────────────┐      ┌──────────────────────────────────────────┐
│  Streamlit   │◀────▶│              F1Agent                     │
│ (frontend)   │      │  ┌────────────┐                          │
└──────────────┘      │  │DomainGuard │  ← domain filter         │
                      │  └─────┬──────┘                          │
                      │        ▼                                  │
                      │  ┌────────────┐    ┌──────────────────┐  │
                      │  │  Gemini    │◀──▶│   Tool calling   │  │
                      │  │ Flash 2.0  │    │  · get_driver…   │  │
                      │  └─────┬──────┘    │  · get_race…     │  │
                      │        │           │  · get_telemetry │  │
                      │        │           │  · predict_pos…  │  │
                      │  ┌─────┴──────┐    └────────┬─────────┘  │
                      │  │ToolValidator│            │            │
                      │  └─────┬──────┘            │            │
                      │        ▼                    ▼            │
                      │  ┌──────────────┐  ┌─────────────────┐  │
                      │  │ Consistency  │  │ SQLite · OpenF1 │  │
                      │  │   Guard      │  │  XGBoost model  │  │
                      │  └──────────────┘  └─────────────────┘  │
                      └──────────────────────────────────────────┘
```

**Semantic layer.** The system prompt embeds the entity mappings (drivers, circuits, constructors) and the tool-selection rules. The LLM never writes SQL or calls the API directly. It always delegates to the tools.

**Tool calling.** The Gemini SDK manages the full invocation cycle. Four tools are available:

| Tool | Data source | Purpose |
|---|---|---|
| `get_driver_standings` | SQLite (Ergast 1950–2024) | Driver profile and basic data |
| `get_race_results` | SQLite (Ergast 1950–2024) | Official results of a Grand Prix |
| `get_telemetry` | OpenF1 API (2023+) | Lap times and recent telemetry |
| `predict_position` | XGBoost model | Estimated final race position |

**Guardrails.** Three chained filters share the same interface, `{"valid": bool, "message": str}`:

| Guardrail | When | What it does |
|---|---|---|
| `DomainGuard` | Before inference | Filters out non-F1 questions with a bilingual (ES/EN) lexical allowlist |
| `ToolValidator` | Before execution | Checks that every invoked tool is on the allowlist and blocks prompt injection |
| `ConsistencyGuard` | After generation | Flags numbers in the answer that do not appear in the data returned by the tools |

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

Features that cannot be read from the database (future races, or drivers with no history) are imputed with the dataset median. The output is clipped to the range [1, 25] and always comes with a note on the model's limitations.

## Evaluation

The benchmark (`evaluation/benchmark.json`) holds 20 reference questions in four categories:

- **descriptive**: historical results and driver profiles
- **predictive**: estimates of future positions
- **comparative**: comparisons across seasons or drivers
- **out_of_domain**: non-F1 questions, which must be refused

`evaluate.py` measures the task completion rate (overall and per category), end-to-end latency (mean, p50, p90) and the estimated cost per query.

## Project structure

```
├── streamlit_app.py        # Conversational frontend (main entry point)
├── config.py               # Environment variables, model and database paths
├── requirements.txt        # Dependencies
├── train_xgboost_tfm.py    # XGBoost training script
├── evaluate.py             # Automatic agent evaluation
├── evaluation/
│   └── benchmark.json      # 20 reference questions with expected answers
├── data/
│   ├── f1_dataset_v2.csv            # Preprocessed training dataset
│   ├── f1_assistant.db              # SQLite database (Ergast dump)
│   ├── F1_XGBoost_TFM.ipynb         # Model development notebook
│   └── F1_Comparativa_Modelos.ipynb # LR / RF / XGBoost comparison notebook
├── models/
│   └── race_pos_model.pkl  # Serialised XGBoost model with its encoders
└── src/
    ├── agent/
    │   └── f1_agent.py           # Orchestrator: LLM + tool calling + guardrails
    ├── api/
    │   ├── db_client.py          # SQLite client (Ergast historical data)
    │   └── f1_client.py          # OpenF1 client (telemetry 2023+)
    ├── guards/
    │   ├── domain_guard.py       # Lexical domain filter (ES/EN)
    │   ├── consistency_guard.py  # Post-generation numeric check
    │   └── tool_validator.py     # Tool allowlist
    ├── ml/
    │   ├── predictor.py          # XGBoost inference wrapper
    │   └── feature_resolver.py   # Resolves the 10 features from SQLite
    └── tools/
        └── f1_tools.py           # Functions exposed to the LLM through tool calling
```

## Getting started

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then set GEMINI_API_KEY

python train_xgboost_tfm.py      # trains and saves models/race_pos_model.pkl
streamlit run streamlit_app.py   # launches the assistant
python evaluate.py --limit 5     # runs part of the benchmark
```

## Data sources

- **Ergast Motor Racing Data**: historical results dump for 1950–2024, stored in a local SQLite database (`data/f1_assistant.db`).
- **OpenF1 API**: telemetry and lap times for sessions from 2023 onwards. It is queried live only when the user asks for recent telemetry.

## Known limitations

- The semantic layer lives in the system prompt. Drivers or circuits missing from the entity maps can cause resolution errors.
- The Gemini SDK runs the tool-calling loop on its own, so `ConsistencyGuard` works on a best-effort basis on the final answer: intermediate tool outputs are not exposed during generation.
- The OpenF1 client only implements `get_laps`. Other endpoints (sectors, intervals, weather) are not implemented.

## License

Academic use only, non-commercial. Historical data courtesy of the public Ergast dumps and the OpenF1 API.
