"""Acceso de solo lectura a la base de datos histórica de Ergast.

Las tablas vienen de un volcado sin claves primarias, por lo que se declaran
como tablas de SQLAlchemy Core (no ORM): el ORM exige identidad por fila y
`race_results` tiene filas legítimamente repetidas (p. ej. dos GPs en el mismo
circuito en 2020).
"""

from functools import lru_cache

from sqlalchemy import Column, Engine, Float, Integer, MetaData, Table, Text, create_engine

from app.core.config import get_settings

metadata = MetaData()

drivers = Table(
    "drivers",
    metadata,
    Column("driver_number", Float),
    Column("full_name", Text),
    Column("nationality", Text),
)

race_results = Table(
    "race_results",
    metadata,
    Column("year", Integer),
    Column("circuit", Text),
    Column("driver_name", Text),
    Column("driver_number", Float),
    Column("constructor", Text),
    Column("grid_position", Integer),
    Column("final_position", Float),
    Column("final_position_order", Integer),
    Column("points", Float),
)


@lru_cache
def get_reference_engine() -> Engine:
    url = get_settings().f1_database_url
    if url.startswith("sqlite:///"):
        # Modo solo lectura: el volcado de Ergast está versionado en git y no se modifica.
        url = f"sqlite:///file:{url.removeprefix('sqlite:///')}?mode=ro&uri=true"
    return create_engine(url)
