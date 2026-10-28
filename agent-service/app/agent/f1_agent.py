"""Agente orquestador F1-GPT.

Integra: capa semántica (system prompt), tool calling sobre Gemini,
guardarraíl de dominio (pre-inferencia), validador de tools y
guardarraíl de consistencia numérica (post-generación).

El agente no guarda estado de conversación: cada llamada recibe el historial
(lo persiste la Chat API), por lo que una única instancia sirve a todos los
usuarios sin mezclar conversaciones.
"""

import functools
import time
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Callable, Literal

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.guards.consistency_guard import ConsistencyGuard
from app.guards.domain_guard import DomainGuard
from app.guards.tool_validator import ToolValidator
from app.tools.f1_tools import F1Tools


SYSTEM_PROMPT_TEMPLATE = """You are F1-GPT, a specialized Formula 1 Research Assistant with access to historical race data (1950–2024), real-time telemetry (2023+), and a predictive XGBoost model for race position estimation. Today is {today}.

## TOOL SELECTION — use exactly the right tool for each query type

- get_driver_standings  → driver nationality, permanent number, career info
- get_race_results      → past race outcomes, winner of a GP, finishing order, points
- get_telemetry         → lap times, sector times, telemetry (2023+ ONLY, requires session_key)
- predict_position      → any question about future or hypothetical finishing position
                          (internally uses 10 pre-race features: grid, championship standings,
                           driver experience, recent form, circuit altitude, season progress)

When a query combines historical context and a prediction (e.g. "Verstappen won last year at Monza, where will he finish this year?"), call get_race_results first, then predict_position.

## ENTITY MAPPING — translate user terms to tool parameters

Driver numbers (driver_number parameter):
  Verstappen=1, Hamilton=44, Leclerc=16, Norris=4, Sainz=55,
  Alonso=14, Pérez=11, Russell=63, Piastri=81, Albon=23,
  Bearman=50, Tsunoda=22, Gasly=10, Ocon=31, Stroll=18,
  Bottas=77, Zhou=24, Magnussen=20, Hülkenberg=27, Colapinto=43

Constructor names (constructor parameter, use exact spelling):
  "Red Bull", "Mercedes", "Ferrari", "McLaren", "Aston Martin",
  "Alpine", "Williams", "RB", "Kick Sauber", "Haas F1 Team"

Circuit names (circuit parameter for get_race_results):
  Monza → "Autodromo Nazionale Monza"
  Silverstone → "Silverstone Circuit"
  Monaco → "Circuit de Monaco"
  Spa → "Circuit de Spa-Francorchamps"
  Suzuka → "Suzuka Circuit"
  Barcelona → "Circuit de Barcelona-Catalunya"
  Interlagos → "Autodromo Jose Carlos Pace"
  Abu Dhabi → "Yas Marina Circuit"
  Bahrain → "Bahrain International Circuit"
  Zandvoort → "Circuit Zandvoort"
  Imola → "Autodromo Enzo e Dino Ferrari"
  Austin → "Circuit of the Americas"
  Mexico → "Autodromo Hermanos Rodriguez"
  Singapore → "Marina Bay Street Circuit"
  Baku → "Baku City Circuit"
  Jeddah → "Jeddah Corniche Circuit"
  Miami → "Miami International Autodrome"
  Las Vegas → "Las Vegas Strip Street Circuit"
  Qatar → "Losail International Circuit"

## RESPONSE FORMAT

Historical queries: answer with clear tables or structured bullet points. Always cite year and circuit.
Predictive queries: lead with the estimated position, then explain the key inputs used (grid, constructor, circuit). Mention that the model internally uses 10 pre-race features including championship standings, driver experience, and recent form. Always add: "⚠️ This is a model estimate based on historical data and does not guarantee the actual result."
Hybrid queries: answer the historical part first, then the prediction.
No data found: say clearly "I don't have data available for this query" — never invent figures.

## CONVERSATION STYLE
- When the user greets you (hola, hello, hi, etc.), respond warmly and briefly introduce yourself as F1-GPT, ready to help with anything about Formula 1.
- Be friendly and natural. You can use a conversational tone while staying focused on F1.
- Assume that general sports questions (world champion, championship, who won, etc.) refer to Formula 1 unless the user specifies otherwise.

## SCOPE RULES
- For get_telemetry: data only exists from 2023 onwards. If the user does not provide a session_key, ask for it before calling the tool.
- Pit stop time estimation and podium probability prediction are not yet implemented — inform the user if asked.
- Respond in the same language the user uses (Spanish if asked in Spanish, English if asked in English).
- Refuse any question not related to Formula 1.
"""


@dataclass
class ChatTurn:
    role: Literal["user", "assistant"]
    content: str


@dataclass
class ToolCall:
    name: str
    args: dict[str, Any]
    result: Any = None
    error: str | None = None


@dataclass
class AgentResult:
    answer: str
    status: Literal["ok", "rejected_domain", "llm_error"]
    model: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    consistency_suspects: list[float] = field(default_factory=list)
    latency_ms: int = 0


class F1Agent:
    """Agente conversacional con tres guardarraíles encadenados."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        f1_tools: F1Tools | None = None,
    ) -> None:
        settings = get_settings()
        self.model = model or settings.gemini_model
        self.client = genai.Client(
            api_key=api_key or settings.gemini_api_key,
            # Sin timeout, una llamada a un Gemini saturado puede quedarse colgada.
            http_options=types.HttpOptions(timeout=settings.llm_timeout_s * 1000),
        )
        self.f1_tools = f1_tools or F1Tools()
        self.domain_guard = DomainGuard()
        self.consistency_guard = ConsistencyGuard()
        self.tool_validator = ToolValidator()

        self._tool_callables: list[Callable[..., Any]] = [
            self.f1_tools.get_driver_standings,
            self.f1_tools.get_race_results,
            self.f1_tools.get_telemetry,
            self.f1_tools.predict_position,
        ]

        # Defensa frente a inyección de prompt: si una función entra en la lista
        # de tools y no está en la allowlist del validator, se elimina.
        self._tool_callables = [
            t for t in self._tool_callables if self.tool_validator.is_valid_tool(t.__name__)
        ]

    # --------------------------------------------------------------------------

    def run(self, query: str, history: list[ChatTurn] | None = None) -> AgentResult:
        """Procesa una consulta del usuario aplicando los tres guardarraíles."""
        t0 = time.perf_counter()

        def done(**kwargs: Any) -> AgentResult:
            return AgentResult(
                model=self.model, latency_ms=int((time.perf_counter() - t0) * 1000), **kwargs
            )

        # 1) Filtro de dominio antes de consumir tokens del LLM. Una pregunta de
        #    seguimiento ("¿y el segundo?") hereda el contexto F1 de la anterior.
        domain = self.domain_guard.validate_query(query)
        last_user = next((t.content for t in reversed(history or []) if t.role == "user"), None)
        if not domain["valid"] and last_user and self.domain_guard.validate_query(last_user)["valid"]:
            domain = {"valid": True, "message": "Follow-up"}
        if not domain["valid"]:
            return done(answer=domain["message"], status="rejected_domain")

        # 2) Inferencia del LLM con reintentos exponenciales en 5xx. Las tools se
        #    envuelven por petición para registrar qué se llamó y qué devolvió.
        calls: list[ToolCall] = []
        chat = self.client.chats.create(
            model=self.model,
            config=types.GenerateContentConfig(
                tools=[self._traced(t, calls) for t in self._tool_callables],
                system_instruction=SYSTEM_PROMPT_TEMPLATE.format(
                    today=date.today().strftime("%A, %B %d, %Y"),
                ),
            ),
            history=[
                types.Content(
                    role="model" if turn.role == "assistant" else "user",
                    parts=[types.Part(text=turn.content)],
                )
                for turn in history or []
            ],
        )
        response_text, ok = self._invoke_with_retry(chat, query)
        if not ok:
            return done(answer=response_text, status="llm_error", tool_calls=calls)

        # 3) Verificación de consistencia post-generación contra los datos que
        #    devolvieron realmente las tools en esta petición.
        consistency = self.consistency_guard.validate_consistency(
            response_text, tool_data=[c.result for c in calls if c.error is None]
        )
        if not consistency["valid"]:
            response_text = (
                f"{response_text}\n\n"
                f"⚠️ Aviso del guardarraíl de consistencia: {consistency['message']}"
            )
        return done(
            answer=response_text,
            status="ok",
            tool_calls=calls,
            consistency_suspects=consistency.get("suspect", []),
        )

    def handle_query(self, query: str) -> str:
        """Compatibilidad con evaluate.py: consulta suelta sin historial."""
        return self.run(query).answer

    # --------------------------------------------------------------------------

    def _traced(self, tool: Callable[..., Any], calls: list[ToolCall]) -> Callable[..., Any]:
        @functools.wraps(tool)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            call = ToolCall(name=tool.__name__, args=kwargs)
            calls.append(call)
            check = self.tool_validator.validate_call(tool.__name__)
            if not check["valid"]:
                call.error = check["message"]
                return {"error": check["message"]}
            try:
                call.result = tool(*args, **kwargs)
                return call.result
            except Exception as exc:  # noqa: BLE001 — el LLM recibe el error como dato
                call.error = str(exc)
                return {"error": str(exc)}

        return wrapper

    def _invoke_with_retry(self, chat: Any, query: str, max_attempts: int = 3) -> tuple[str, bool]:
        for attempt in range(max_attempts):
            try:
                return chat.send_message(query).text or "", True
            except Exception as exc:  # noqa: BLE001 — propagamos texto controlado
                err = str(exc)
                if "429" in err or "RESOURCE_EXHAUSTED" in err:
                    return "Has agotado tu cuota de Gemini. Espera unos minutos o revisa Google AI Studio.", False
                if "503" in err or "UNAVAILABLE" in err:
                    if attempt < max_attempts - 1:
                        time.sleep(3 * (attempt + 1))
                        continue
                    return "Servidores de Gemini saturados. Inténtalo de nuevo en unos segundos.", False
                return f"Error: {err}", False
        return "Error: no se pudo completar la consulta.", False
