"""Guardarraíl de validación de herramientas (allowlist).

Comprueba que cualquier llamada a herramienta procedente del LLM
corresponda a una función registrada del sistema. Defensa básica frente
a intentos de inyección de prompt que induzcan al modelo a invocar
funciones no declaradas.
"""

from typing import Iterable


class ToolValidator:
    """Verifica que el nombre de herramienta esté en la lista blanca."""

    #: Nombres canónicos de las herramientas autorizadas. Coinciden con los
    #: declarados en :class:`F1Tools` y con el system prompt del agente.
    ALLOWED_TOOLS: frozenset[str] = frozenset(
        {
            "get_driver_standings",
            "get_race_results",
            "get_telemetry",
            "predict_position",
        }
    )

    def __init__(self, allowed_tools: Iterable[str] | None = None) -> None:
        self.allowed_tools: frozenset[str] = (
            frozenset(allowed_tools) if allowed_tools is not None else self.ALLOWED_TOOLS
        )

    def is_valid_tool(self, name: str) -> bool:
        """Devuelve True si `name` está en la lista blanca."""
        return name in self.allowed_tools

    def validate_call(self, name: str) -> dict[str, str | bool]:
        """Devuelve la estructura estándar de los guardarraíles."""
        if self.is_valid_tool(name):
            return {"valid": True, "message": "Tool autorizada."}
        return {
            "valid": False,
            "message": f"Tool no autorizada: {name!r}. No se ejecutará.",
        }
