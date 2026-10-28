"""Consultas sobre el histórico de Ergast con SQLAlchemy Core."""

from typing import Any

from sqlalchemy import Engine, or_, select

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
