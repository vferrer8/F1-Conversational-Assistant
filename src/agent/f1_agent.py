"""Agente orquestador F1-GPT.

Integra: capa semántica (system prompt), tool calling sobre Gemini,
guardarraíl de dominio (pre-inferencia), validador de tools y
guardarraíl de consistencia numérica (post-generación).
"""

import time
from datetime import date

from google import genai
from google.genai import types

from config import GEMINI_API_KEY
from src.guards.consistency_guard import ConsistencyGuard
from src.guards.domain_guard import DomainGuard
from src.guards.tool_validator import ToolValidator
from src.tools.f1_tools import F1Tools


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


class F1Agent:
    """Agente conversacional con tres guardarraíles encadenados."""

    def __init__(self, api_key: str | None = GEMINI_API_KEY) -> None:
        self.client = genai.Client(api_key=api_key)
        self.f1_tools = F1Tools()
        self.domain_guard = DomainGuard()
        self.consistency_guard = ConsistencyGuard()
        self.tool_validator = ToolValidator()

        self._tool_callables = [
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

        self.chat = self.client.chats.create(
            model="models/gemini-flash-latest",
            config=types.GenerateContentConfig(
                tools=self._tool_callables,
                system_instruction=SYSTEM_PROMPT_TEMPLATE.format(
                    today=date.today().strftime("%A, %B %d, %Y"),
                ),
            ),
        )

    # --------------------------------------------------------------------------

    def handle_query(self, query: str) -> str:
        """Procesa una consulta del usuario aplicando los tres guardarraíles."""
        # 1) Filtro de dominio antes de consumir tokens del LLM.
        domain = self.domain_guard.validate_query(query)
        if not domain["valid"]:
            return domain["message"]

        # 2) Inferencia del LLM con reintentos exponenciales en 5xx.
        response_text = self._invoke_with_retry(query)

        # 3) Verificación de consistencia post-generación.
        #    Limitación conocida (ver memoria, sección 5.6): los resultados
        #    intermedios de las tools no quedan expuestos por el SDK; el
        #    guardarraíl se aplica de forma "best effort" sobre la respuesta.
        consistency = self.consistency_guard.validate_consistency(response_text, tool_data={})
        if not consistency["valid"]:
            return (
                f"{response_text}\n\n"
                f"⚠️ Aviso del guardarraíl de consistencia: {consistency['message']}"
            )
        return response_text

    # --------------------------------------------------------------------------

    def _invoke_with_retry(self, query: str, max_attempts: int = 3) -> str:
        for attempt in range(max_attempts):
            try:
                return self.chat.send_message(query).text
            except Exception as exc:  # noqa: BLE001 — propagamos texto controlado
                err = str(exc)
                if "429" in err or "RESOURCE_EXHAUSTED" in err:
                    return "Has agotado tu cuota de Gemini. Espera unos minutos o revisa Google AI Studio."
                if "503" in err or "UNAVAILABLE" in err:
                    if attempt < max_attempts - 1:
                        time.sleep(3 * (attempt + 1))
                        continue
                    return "Servidores de Gemini saturados. Inténtalo de nuevo en unos segundos."
                return f"Error: {err}"
        return "Error: no se pudo completar la consulta."
