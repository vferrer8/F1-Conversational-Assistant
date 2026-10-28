import unicodedata


def _normalize(text: str) -> str:
    """Elimina acentos y pasa a minúsculas para comparación robusta."""
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("utf-8").lower()


class DomainGuard:

    # ── English keywords ──────────────────────────────────────────────────────
    KEYWORDS_EN = [
        # Core
        "formula 1", "formula one", "f1", "grand prix", "gp",
        # Race format
        "qualifying", "pole position", "podium", "sprint race", "pit stop", "pit lane",
        "safety car", "virtual safety car", "fastest lap", "lap time", "sector time",
        "drs", "kers", "ers", "dnf", "grid position", "championship", "world champion",
        "constructor standings", "driver standings", "fia", "steward", "penalty",
        "race winner", "race result", "finishing position", "won the race", "race won",
        "who won", "who will win", "winner of",
        # Current drivers
        "verstappen", "hamilton", "leclerc", "norris", "sainz", "alonso",
        "perez", "pérez", "russell", "piastri", "albon", "tsunoda", "gasly",
        "ocon", "stroll", "bottas", "magnussen", "hulkenberg", "hülkenberg",
        "colapinto", "bearman", "zhou", "lawson",
        # Legend drivers
        "schumacher", "senna", "prost", "lauda", "vettel", "raikkonen", "räikkönen",
        "rosberg", "button", "webber", "barrichello", "massa", "hill", "mansell",
        # Teams
        "ferrari", "mercedes", "red bull", "mclaren", "aston martin",
        "alpine", "williams", "haas", "kick sauber", "rb team", "renault",
        "benetton", "brawn", "tyrrell", "brabham", "lotus",
        # Circuits - current
        "monza", "silverstone", "monaco", "spa-francorchamps", "suzuka",
        "barcelona", "interlagos", "zandvoort", "imola", "austin", "singapore",
        "baku", "jeddah", "miami", "hungaroring", "montreal", "albert park",
        "yas marina", "losail", "sakhir", "las vegas strip",
        # Circuits - historical
        "nurburgring", "hockenheim", "istanbul", "sepang", "shanghai",
        "magny-cours", "estoril", "adelaide", "jerez", "kyalami",
        # Tyre & strategy
        "soft tyre", "medium tyre", "hard tyre", "intermediate tyre",
        "tyre strategy", "tyre compound", "tyre degradation", "undercut", "overcut", "stint",
        # Technical
        "telemetry", "downforce", "aerodynamics", "setup", "diffuser",
        "front wing", "rear wing", "power unit", "engine penalty",
    ]

    # ── Spanish keywords ──────────────────────────────────────────────────────
    KEYWORDS_ES = [
        # Términos core
        "fórmula 1", "formula 1", "fórmula uno", "gran premio", "grandes premios",
        # Resultados y carrera — términos contextuales clave
        "ganador", "ganadora", "ganó", "quién ganó", "quién gana",
        "último ganador", "último ganó", "último gran premio",
        "piloto", "pilotos", "carrera", "carreras", "vuelta", "vueltas",
        "clasificación", "clasificatorio", "posición final", "posición de salida",
        "parrilla de salida", "pole", "podio", "podium",
        "campeón", "campeonato", "subcampeón", "escudería", "escuderías",
        "constructor", "constructores",
        # Formato de carrera
        "clasificación", "qualy", "vuelta rápida", "tiempo de vuelta",
        "coche de seguridad", "bandera roja", "bandera amarilla", "bandera a cuadros",
        "parada en boxes", "boxes", "vuelta de formación",
        "salida", "adelantamiento", "abandono", "retirada", "penalización",
        "sanción", "dirección de carrera", "comisarios", "protesta",
        "sector", "tiempo de sector", "vuelta de instalación",
        # Estrategia y neumáticos
        "neumático", "neumáticos", "goma", "compuesto", "blando", "medio", "duro",
        "intermedio", "lluvia", "degradación", "estrategia", "undercut", "overcut",
        "stint", "parada", "parada doble", "subvalorado", "rebase",
        # Técnico
        "telemetría", "aerodinámica", "carga aerodinámica", "difusor",
        "alerón delantero", "alerón trasero", "unidad de potencia", "motor",
        "penalización de motor", "setup", "configuración", "dirección",
        # Standings
        "clasificación de pilotos", "clasificación de constructores",
        "campeonato de pilotos", "campeonato de constructores",
        "puntos", "lider del campeonato", "líder",
        # Temporada y contexto
        "temporada", "temporada actual", "temporada pasada", "gran premio anterior",
        "próxima carrera", "próximo gran premio", "calendario", "circuito",
        "trazado", "vuelta al circuito",
    ]

    KEYWORDS = KEYWORDS_EN + KEYWORDS_ES

    # Saludos y mensajes conversacionales que siempre se permiten
    GREETINGS = [
        "hola", "hello", "hi", "hey", "buenas", "buenos días", "buenas tardes",
        "buenas noches", "good morning", "good afternoon", "good evening",
        "gracias", "thanks", "thank you", "de nada", "ok", "okay", "vale",
        "adios", "bye", "hasta luego",
    ]

    def validate_query(self, query: str) -> dict:
        """Returns valid=True if query is F1-related or a greeting (English or Spanish)."""
        q = query.lower()
        q_norm = _normalize(query)

        # Saludos y mensajes cortos siempre pasan
        if any(g in q for g in self.GREETINGS):
            return {"valid": True, "message": "Success"}

        # Comprobación con y sin acentos
        keywords_norm = [_normalize(k) for k in self.KEYWORDS]
        if any(k in q for k in self.KEYWORDS) or any(k in q_norm for k in keywords_norm):
            return {"valid": True, "message": "Success"}

        return {"valid": False, "message": "Este asistente solo responde preguntas sobre Fórmula 1. / This assistant only handles Formula 1 related questions."}
