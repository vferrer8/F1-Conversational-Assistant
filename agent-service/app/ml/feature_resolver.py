"""
Resuelve las 10 features del modelo XGBoost desde la base de datos histórica.

  grid, year             → recibidos directamente del agente
  circuit_alt            → mapa hardcodeado de circuito → altitud
  driver_age             → mapa de número FIA → año de nacimiento + año carrera
  season_progress        → round / total_rounds  (races_raw)
  driver_experience      → COUNT de GPs previos  (results_raw)
  avg_finish_last3       → media últimas 3 posiciones (results_raw)
  driver_pos_before      → posición campeonato antes de la carrera (driver_standings)
  driver_wins_before     → victorias en la temporada hasta esa carrera (driver_standings)
  constructor_pos_before → posición constructor antes de la carrera (constructor_standings)

Para carreras futuras o pilotos sin datos, se usan las medianas del dataset.
"""

from __future__ import annotations

from typing import Any, Optional

import pandas as pd
from sqlalchemy import Connection, Engine, text

from app.core.config import get_settings
from app.db.reference import get_reference_engine

# ── Altitud (m) de los principales circuitos ────────────────────────────────
CIRCUIT_ALTITUDE: dict[str, float] = {
    "Circuit de Monaco": 7.0,
    "Autodromo Nazionale Monza": 153.0,
    "Silverstone Circuit": 153.0,
    "Circuit de Spa-Francorchamps": 401.0,
    "Suzuka Circuit": 40.0,
    "Circuit de Barcelona-Catalunya": 109.0,
    "Autodromo Jose Carlos Pace": 760.0,
    "Yas Marina Circuit": 3.0,
    "Bahrain International Circuit": 6.0,
    "Circuit Zandvoort": 1.0,
    "Autodromo Enzo e Dino Ferrari": 47.0,
    "Circuit of the Americas": 149.0,
    "Autodromo Hermanos Rodriguez": 2270.0,
    "Marina Bay Street Circuit": 15.0,
    "Baku City Circuit": -28.0,
    "Jeddah Corniche Circuit": 15.0,
    "Miami International Autodrome": 0.0,
    "Las Vegas Strip Street Circuit": 620.0,
    "Losail International Circuit": 32.0,
    "Hungaroring": 264.0,
    "Circuit Gilles Villeneuve": 20.0,
    "Albert Park Circuit": 10.0,
    "Hockenheimring": 104.0,
    "Nürburgring": 600.0,
    "Sepang International Circuit": 22.0,
    "Autodromo Internationale del Mugello": 334.0,
    "Portimao": 148.0,
    "Circuit Paul Ricard": 430.0,
    "Kyalami": 1548.0,
    "Istanbul Park": 130.0,
    "Autodromo Oscar Alfredo Galvez": 10.0,
    "Estoril": 130.0,
    "Fuji Speedway": 583.0,
    "Indianapolis Motor Speedway": 220.0,
}

# Keyword del nombre del GP en races_raw.name para cada circuito
CIRCUIT_TO_GP_KEYWORD: dict[str, str] = {
    "Circuit de Monaco": "Monaco",
    "Autodromo Nazionale Monza": "Italian",
    "Silverstone Circuit": "British",
    "Circuit de Spa-Francorchamps": "Belgian",
    "Suzuka Circuit": "Japanese",
    "Circuit de Barcelona-Catalunya": "Spanish",
    "Autodromo Jose Carlos Pace": "Brazilian",
    "Yas Marina Circuit": "Abu Dhabi",
    "Bahrain International Circuit": "Bahrain",
    "Circuit Zandvoort": "Dutch",
    "Autodromo Enzo e Dino Ferrari": "Emilia",
    "Circuit of the Americas": "United States",
    "Autodromo Hermanos Rodriguez": "Mexico",
    "Marina Bay Street Circuit": "Singapore",
    "Baku City Circuit": "Azerbaijan",
    "Jeddah Corniche Circuit": "Saudi",
    "Miami International Autodrome": "Miami",
    "Las Vegas Strip Street Circuit": "Las Vegas",
    "Losail International Circuit": "Qatar",
    "Hungaroring": "Hungarian",
    "Circuit Gilles Villeneuve": "Canadian",
    "Albert Park Circuit": "Australian",
}

# Alias: número que usa el agente → número real en la DB Ergast
# (Verstappen adoptó el #1 al ser campeón en 2022; Ergast lo tiene como #33)
DRIVER_NUMBER_ALIAS: dict[int, int] = {
    1: 33,   # Verstappen
}

# Año de nacimiento de los pilotos actuales (número FIA → año)
DRIVER_BIRTH_YEAR: dict[int, int] = {
    1: 1997,   # Verstappen
    44: 1985,  # Hamilton
    16: 1997,  # Leclerc
    4: 1999,   # Norris
    55: 1994,  # Sainz
    14: 1981,  # Alonso
    11: 1990,  # Pérez
    63: 1998,  # Russell
    81: 2001,  # Piastri
    23: 1996,  # Albon
    22: 2000,  # Tsunoda
    10: 1996,  # Gasly
    31: 1996,  # Ocon
    18: 1998,  # Stroll
    77: 1989,  # Bottas
    24: 1999,  # Zhou
    20: 1992,  # Magnussen
    27: 1987,  # Hülkenberg
    50: 2005,  # Bearman
    43: 2003,  # Colapinto
}

_STAT_COLS = [
    "driver_pos_before", "driver_wins_before", "constructor_pos_before",
    "driver_experience", "driver_age", "avg_finish_last3",
    "circuit_alt", "season_progress",
]

def _load_medians() -> dict[str, float]:
    try:
        df = pd.read_csv(get_settings().dataset_path, usecols=_STAT_COLS)
        return {col: float(df[col].median()) for col in _STAT_COLS}
    except Exception:
        return {
            "driver_pos_before": 14.0, "driver_wins_before": 0.0,
            "constructor_pos_before": 7.0, "driver_experience": 46.0,
            "driver_age": 29.4, "avg_finish_last3": 12.3,
            "circuit_alt": 153.0, "season_progress": 0.5,
        }

_MEDIANS: dict[str, float] = _load_medians()


def _one(conn: Connection, sql: str, **params: Any) -> Any:
    return conn.execute(text(sql), params).mappings().first()


class FeatureResolver:
    """Construye el vector de 10 features para el modelo XGBoost."""

    def __init__(self, engine: Engine | None = None) -> None:
        self.engine = engine or get_reference_engine()

    def resolve(
        self,
        year: int,
        circuit: str,
        driver_number: int,
        grid: int,
        constructor: str,
    ) -> dict[str, float]:
        features: dict[str, float] = {
            "grid": float(grid),
            "year": float(year),
            "circuit_alt": self._get_circuit_alt(circuit),
            "driver_age": self._get_driver_age(driver_number, year),
        }

        try:
            with self.engine.connect() as conn:

                race_id, race_round, total_rounds = self._get_race_info(conn, year, circuit)
                driver_id = self._get_driver_id(conn, driver_number)
                constructor_id = self._get_constructor_id(conn, constructor)

                features["season_progress"] = (
                    float(race_round) / float(total_rounds)
                    if race_round and total_rounds
                    else _MEDIANS["season_progress"]
                )

                if driver_id and race_round is not None:
                    prev = race_round - 1
                    features["driver_pos_before"] = self._get_driver_pos(conn, driver_id, year, prev)
                    features["driver_wins_before"] = self._get_driver_wins(conn, driver_id, year, prev)
                    features["driver_experience"] = self._get_driver_experience(
                        conn, driver_id, year, race_round
                    )
                    features["avg_finish_last3"] = self._get_avg_finish_last3(
                        conn, driver_id, year, race_round
                    )
                else:
                    features["driver_pos_before"] = _MEDIANS["driver_pos_before"]
                    features["driver_wins_before"] = _MEDIANS["driver_wins_before"]
                    features["driver_experience"] = _MEDIANS["driver_experience"]
                    features["avg_finish_last3"] = _MEDIANS["avg_finish_last3"]

                features["constructor_pos_before"] = (
                    self._get_constructor_pos(conn, constructor_id, year, race_round - 1)
                    if constructor_id and race_round
                    else _MEDIANS["constructor_pos_before"]
                )

        except Exception:
            features.setdefault("season_progress", _MEDIANS["season_progress"])
            features.setdefault("driver_pos_before", _MEDIANS["driver_pos_before"])
            features.setdefault("driver_wins_before", _MEDIANS["driver_wins_before"])
            features.setdefault("driver_experience", _MEDIANS["driver_experience"])
            features.setdefault("avg_finish_last3", _MEDIANS["avg_finish_last3"])
            features.setdefault("constructor_pos_before", _MEDIANS["constructor_pos_before"])

        return features

    # ── helpers ─────────────────────────────────────────────────────────────

    def _get_circuit_alt(self, circuit: str) -> float:
        if circuit in CIRCUIT_ALTITUDE:
            return CIRCUIT_ALTITUDE[circuit]
        cl = circuit.lower()
        for name, alt in CIRCUIT_ALTITUDE.items():
            if any(w in name.lower() for w in cl.split() if len(w) > 3):
                return alt
        return _MEDIANS["circuit_alt"]

    def _get_driver_age(self, driver_number: int, year: int) -> float:
        birth_year = DRIVER_BIRTH_YEAR.get(driver_number)
        return float(year - birth_year) if birth_year else _MEDIANS["driver_age"]

    def _get_race_info(
        self, conn: Connection, year: int, circuit: str
    ) -> tuple[Optional[int], Optional[int], Optional[int]]:
        def _fetch(keyword: str):
            return _one(
                conn,
                "SELECT raceId, round FROM races_raw WHERE year=:year AND name LIKE :kw LIMIT 1",
                year=year,
                kw=f"%{keyword}%",
            )

        row = None
        kw = CIRCUIT_TO_GP_KEYWORD.get(circuit)
        if kw:
            row = _fetch(kw)
        if not row:
            for word in reversed(circuit.split()):
                if len(word) >= 5:
                    row = _fetch(word)
                    if row:
                        break
        if not row:
            for word in circuit.split():
                if len(word) >= 4:
                    row = _fetch(word)
                    if row:
                        break
        if not row:
            return None, None, None

        race_id = int(row["raceId"])
        race_round = int(row["round"])
        total = _one(conn, "SELECT MAX(round) AS total FROM races_raw WHERE year=:year", year=year)["total"]
        return race_id, race_round, int(total) if total else 20

    def _get_driver_id(self, conn: Connection, driver_number: int) -> Optional[int]:
        # Algunos pilotos tienen un número distinto en Ergast (ej. Verstappen: 1 → 33)
        lookup = DRIVER_NUMBER_ALIAS.get(driver_number, driver_number)
        # Los números se reutilizan (el #4 fue de Chilton antes que de Norris):
        # nos quedamos con el piloto más reciente, que tiene el driverId más alto.
        row = _one(
            conn,
            "SELECT driverId FROM drivers_raw WHERE number=:num ORDER BY driverId DESC LIMIT 1",
            num=lookup,
        )
        return int(row["driverId"]) if row else None

    def _get_constructor_id(self, conn: Connection, constructor: str) -> Optional[int]:
        row = _one(
            conn,
            "SELECT constructorId FROM constructors_raw WHERE name LIKE :name LIMIT 1",
            name=f"%{constructor}%",
        )
        return int(row["constructorId"]) if row else None

    def _get_driver_pos(
        self, conn: Connection, driver_id: int, year: int, prev_round: int
    ) -> float:
        if prev_round <= 0:
            return _MEDIANS["driver_pos_before"]
        row = _one(
            conn,
            """
            SELECT ds.position FROM driver_standings ds
            JOIN races_raw r ON ds.raceId = r.raceId
            WHERE ds.driverId=:driver_id AND r.year=:year AND r.round<=:prev_round
            ORDER BY r.round DESC LIMIT 1
            """,
            driver_id=driver_id, year=year, prev_round=prev_round,
        )
        return float(row["position"]) if row and row["position"] else _MEDIANS["driver_pos_before"]

    def _get_driver_wins(
        self, conn: Connection, driver_id: int, year: int, prev_round: int
    ) -> float:
        if prev_round <= 0:
            return 0.0
        row = _one(
            conn,
            """
            SELECT ds.wins FROM driver_standings ds
            JOIN races_raw r ON ds.raceId = r.raceId
            WHERE ds.driverId=:driver_id AND r.year=:year AND r.round<=:prev_round
            ORDER BY r.round DESC LIMIT 1
            """,
            driver_id=driver_id, year=year, prev_round=prev_round,
        )
        return float(row["wins"]) if row and row["wins"] is not None else 0.0

    def _get_driver_experience(
        self, conn: Connection, driver_id: int, year: int, race_round: int
    ) -> float:
        row = _one(
            conn,
            """
            SELECT COUNT(*) AS cnt FROM results_raw r
            JOIN races_raw ra ON r.raceId = ra.raceId
            WHERE r.driverId=:driver_id
              AND (ra.year < :year OR (ra.year=:year AND ra.round < :race_round))
            """,
            driver_id=driver_id, year=year, race_round=race_round,
        )
        return float(row["cnt"]) if row else _MEDIANS["driver_experience"]

    def _get_avg_finish_last3(
        self, conn: Connection, driver_id: int, year: int, race_round: int
    ) -> float:
        row = _one(
            conn,
            """
            SELECT AVG(positionOrder) AS avg_pos FROM (
                SELECT r.positionOrder FROM results_raw r
                JOIN races_raw ra ON r.raceId = ra.raceId
                WHERE r.driverId=:driver_id AND r.positionOrder IS NOT NULL
                  AND (ra.year < :year OR (ra.year=:year AND ra.round < :race_round))
                ORDER BY ra.year DESC, ra.round DESC
                LIMIT 3
            )
            """,
            driver_id=driver_id, year=year, race_round=race_round,
        )
        return (
            float(row["avg_pos"])
            if row and row["avg_pos"] is not None
            else _MEDIANS["avg_finish_last3"]
        )

    def _get_constructor_pos(
        self, conn: Connection, constructor_id: int, year: int, prev_round: int
    ) -> float:
        if prev_round <= 0:
            return _MEDIANS["constructor_pos_before"]
        row = _one(
            conn,
            """
            SELECT cs.position FROM constructor_standings cs
            JOIN races_raw r ON cs.raceId = r.raceId
            WHERE cs.constructorId=:constructor_id AND r.year=:year AND r.round<=:prev_round
            ORDER BY r.round DESC LIMIT 1
            """,
            constructor_id=constructor_id, year=year, prev_round=prev_round,
        )
        return (
            float(row["position"])
            if row and row["position"]
            else _MEDIANS["constructor_pos_before"]
        )
