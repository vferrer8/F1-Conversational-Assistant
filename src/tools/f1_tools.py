"""Herramientas que el agente F1-GPT puede invocar mediante tool calling.

Los nombres de cada función son significativos: el LLM los selecciona a
partir del system prompt, por lo que deben mantenerse alineados con la
memoria del TFM (sección 5.6 y siguientes).
"""

from typing import Any, Dict, List, Optional

from src.api.db_client import F1Database
from src.api.f1_client import F1Client
from src.ml.predictor import F1Predictor


class F1Tools:
    """Conjunto de herramientas deterministas disponibles para el agente."""

    def __init__(self) -> None:
        self.client = F1Client()
        self.db = F1Database()
        self.predictor = F1Predictor()

    # -- Histórico estructurado --------------------------------------------------

    def get_driver_standings(
        self,
        driver_name: Optional[str] = None,
        driver_number: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Ficha y posición histórica de un piloto.

        Devuelve nacionalidad, número permanente y datos básicos. Acepta
        bien el nombre (búsqueda parcial) bien el número FIA.
        """
        if driver_name:
            result = self.db.get_driver_by_name(driver_name)
            if result:
                return result
        if driver_number is not None:
            return self.db.get_driver_by_number(driver_number) or {}
        return {}

    def get_race_results(
        self,
        year: int,
        circuit: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Resultados oficiales de un GP (orden de llegada, puntos, equipo)."""
        return self.db.query_race_results(year, circuit)

    # -- Telemetría reciente -----------------------------------------------------

    def get_telemetry(
        self,
        session_key: int,
        driver_number: int,
    ) -> List[Dict[str, Any]]:
        """Telemetría OpenF1 (vueltas, sectores) desde 2023."""
        return self.client.get_laps(session_key=session_key, driver_number=driver_number)

    # -- Módulo predictivo -------------------------------------------------------

    def predict_position(
        self,
        year: int,
        circuit: str,
        driver_number: int,
        grid: int,
        constructor: str,
    ) -> Dict[str, Any]:
        """Predice la posición final de carrera con el modelo XGBoost."""
        position = self.predictor.predict_race_position(
            year=year,
            circuit=circuit,
            driver_number=driver_number,
            grid=grid,
            constructor=constructor,
        )
        return {
            "driver_number": driver_number,
            "circuit": circuit,
            "grid_position": grid,
            "predicted_final_position": position,
            "warning": (
                "Estimación del modelo basada en datos históricos; "
                "no garantiza el resultado real."
            ),
        }
