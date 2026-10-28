"""Guardarraíl post-generación de consistencia numérica.

Detecta posibles alucinaciones cuantitativas comparando los números que
aparecen en el texto generado por el LLM con los presentes en los datos
devueltos por las herramientas. Sigue el algoritmo en tres pasos
descrito en la memoria del TFM (sección 5.6).
"""

import re
from typing import Any, Iterable


class ConsistencyGuard:
    """Verifica la coherencia numérica entre respuesta y datos de origen."""

    #: Umbral por debajo del cual los números se consideran "ruido" (posiciones,
    #: número de vueltas, etc.) y se ignoran a la hora de detectar alucinaciones.
    NUMBER_THRESHOLD: float = 50.0

    _NUM_RE = re.compile(r"-?\d+(?:[.,]\d+)?")

    def _extract_numbers(self, source: Any) -> set[float]:
        """Recoge cualquier número (int/float) presente en `source`.

        Acepta texto, dict, list o estructuras anidadas y los aplana.
        """
        numbers: set[float] = set()

        def walk(obj: Any) -> None:
            if obj is None:
                return
            if isinstance(obj, bool):
                return
            if isinstance(obj, (int, float)):
                numbers.add(float(obj))
                return
            if isinstance(obj, str):
                for match in self._NUM_RE.findall(obj):
                    try:
                        numbers.add(float(match.replace(",", ".")))
                    except ValueError:
                        pass
                return
            if isinstance(obj, dict):
                for value in obj.values():
                    walk(value)
                return
            if isinstance(obj, Iterable):
                for value in obj:
                    walk(value)

        walk(source)
        return numbers

    def validate_consistency(
        self,
        response: str,
        tool_data: Any,
        tolerance: float = 0.5,
    ) -> dict[str, Any]:
        """Comprueba que los números en `response` provengan de `tool_data`.

        Args:
            response: texto final generado por el LLM.
            tool_data: datos crudos devueltos por las herramientas (puede ser
                dict, lista, string serializado, etc.).
            tolerance: margen absoluto admitido al comparar números (útil para
                redondeos en tiempos por vuelta).

        Returns:
            Diccionario con la forma estándar de los guardarraíles del
            sistema: ``{"valid": bool, "message": str, "suspect": list}``.
        """
        source_numbers = self._extract_numbers(tool_data)
        # Sin datos de herramientas no hay referencia con la que comparar
        if not source_numbers:
            return {"valid": True, "message": "Respuesta coherente con los datos.", "suspect": []}

        response_numbers = {n for n in self._extract_numbers(response) if abs(n) >= self.NUMBER_THRESHOLD}

        suspect: list[float] = []
        for n in response_numbers:
            if not any(abs(n - s) <= tolerance for s in source_numbers):
                suspect.append(n)

        if suspect:
            return {
                "valid": False,
                "message": (
                    "Posible inconsistencia numérica: los valores "
                    f"{sorted(suspect)} no aparecen en los datos devueltos por las herramientas."
                ),
                "suspect": sorted(suspect),
            }
        return {"valid": True, "message": "Respuesta coherente con los datos.", "suspect": []}
