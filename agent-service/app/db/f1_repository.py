"""Consultas sobre el histórico de Ergast con SQLAlchemy Core."""

from typing import Any

from sqlalchemy import Engine, or_, select, text

from app.db.reference import drivers, get_reference_engine, race_results
from app.ml.feature_resolver import CIRCUIT_TO_GP_KEYWORD


def _gp_keywords_for(circuit: str) -> list[str]:
    """'Monza' o 'Autodromo Nazionale Monza' → ['Italian']."""
    term = circuit.lower()
    return [
        kw
        for name, kw in CIRCUIT_TO_GP_KEYWORD.items()
        if term == name.lower() or (len(term) >= 4 and term in name.lower())
    ]


class F1Repository:
    def __init__(self, engine: Engine | None = None) -> None:
        self.engine = engine or get_reference_engine()

    def get_driver_by_number(self, driver_number: int) -> dict[str, Any] | None:
        stmt = select(drivers).where(drivers.c.driver_number == driver_number).limit(1)
        with self.engine.connect() as conn:
            row = conn.execute(stmt).mappings().first()
        return dict(row) if row else None

    def get_driver_by_name(self, name_part: str) -> dict[str, Any] | None:
        stmt = select(drivers).where(drivers.c.full_name.ilike(f"%{name_part}%")).limit(1)
        with self.engine.connect() as conn:
            row = conn.execute(stmt).mappings().first()
        return dict(row) if row else None

    def search_drivers(self, query: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        stmt = select(drivers).order_by(drivers.c.full_name).limit(limit)
        if query:
            stmt = stmt.where(drivers.c.full_name.ilike(f"%{query}%"))
        with self.engine.connect() as conn:
            return [dict(r) for r in conn.execute(stmt).mappings()]

    def stats(self) -> dict[str, int]:
        sql = """
            SELECT
              (SELECT COUNT(DISTINCT year) FROM races_raw) AS seasons,
              (SELECT MIN(year) FROM races_raw)            AS first_season,
              (SELECT MAX(year) FROM races_raw)            AS last_season,
              (SELECT COUNT(*) FROM races_raw)             AS races,
              (SELECT COUNT(*) FROM drivers_raw)           AS drivers,
              (SELECT COUNT(*) FROM constructors_raw)      AS constructors,
              (SELECT COUNT(*) FROM results_raw)           AS results,
              (SELECT COUNT(*) FROM lap_times)             AS lap_times
        """
        with self.engine.connect() as conn:
            return dict(conn.execute(text(sql)).mappings().one())

    def seasons(self) -> list[int]:
        with self.engine.connect() as conn:
            return list(conn.execute(text("SELECT DISTINCT year FROM races_raw ORDER BY year DESC")).scalars())

    def season_races(self, year: int) -> list[dict[str, Any]]:
        sql = "SELECT round, name, date FROM races_raw WHERE year = :year ORDER BY round"
        with self.engine.connect() as conn:
            return [dict(r) for r in conn.execute(text(sql), {"year": year}).mappings()]

    def season_standings(self, year: int, limit: int = 20) -> list[dict[str, Any]]:
        """Clasificación de pilotos tras la última carrera de la temporada."""
        sql = """
            WITH last_race AS (
              SELECT raceId FROM races_raw WHERE year = :year ORDER BY round DESC LIMIT 1
            )
            SELECT ds.position, d.full_name AS driver, ds.points, ds.wins,
                   (SELECT c.name FROM results_raw r
                      JOIN races_raw ra ON ra.raceId = r.raceId
                      JOIN constructors_raw c ON c.constructorId = r.constructorId
                     WHERE r.driverId = ds.driverId AND ra.year = :year
                     ORDER BY ra.round DESC LIMIT 1) AS constructor
            FROM driver_standings ds
            JOIN last_race lr ON lr.raceId = ds.raceId
            JOIN drivers_raw d ON d.driverId = ds.driverId
            ORDER BY ds.position
            LIMIT :limit
        """
        with self.engine.connect() as conn:
            return [dict(r) for r in conn.execute(text(sql), {"year": year, "limit": limit}).mappings()]

    def query_race_results(self, year: int, circuit: str | None = None) -> list[dict[str, Any]]:
        stmt = (
            select(race_results)
            .where(race_results.c.year == year)
            .order_by(race_results.c.circuit, race_results.c.final_position_order)
        )
        if circuit:
            # La columna guarda el nombre del GP ("Italian Grand Prix"), pero el
            # system prompt mapea a nombres de circuito ("Autodromo Nazionale Monza").
            terms = {circuit, *_gp_keywords_for(circuit)}
            stmt = stmt.where(or_(*(race_results.c.circuit.ilike(f"%{t}%") for t in terms)))
        with self.engine.connect() as conn:
            return [dict(r) for r in conn.execute(stmt).mappings()]
