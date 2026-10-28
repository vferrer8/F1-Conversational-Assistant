"""Opciones válidas para el predictor (parrilla 2024, última temporada con datos)."""

from app.ml.feature_resolver import CIRCUIT_TO_GP_KEYWORD

# (número FIA, nombre, equipo 2024 tal como aparece en constructors_raw)
DRIVERS_2024: list[tuple[int, str, str]] = [
    (1, "Max Verstappen", "Red Bull"),
    (11, "Sergio Pérez", "Red Bull"),
    (16, "Charles Leclerc", "Ferrari"),
    (55, "Carlos Sainz", "Ferrari"),
    (4, "Lando Norris", "McLaren"),
    (81, "Oscar Piastri", "McLaren"),
    (44, "Lewis Hamilton", "Mercedes"),
    (63, "George Russell", "Mercedes"),
    (14, "Fernando Alonso", "Aston Martin"),
    (18, "Lance Stroll", "Aston Martin"),
    (10, "Pierre Gasly", "Alpine F1 Team"),
    (31, "Esteban Ocon", "Alpine F1 Team"),
    (23, "Alexander Albon", "Williams"),
    (43, "Franco Colapinto", "Williams"),
    (22, "Yuki Tsunoda", "RB F1 Team"),
    (77, "Valtteri Bottas", "Sauber"),
    (24, "Zhou Guanyu", "Sauber"),
    (27, "Nico Hülkenberg", "Haas F1 Team"),
    (20, "Kevin Magnussen", "Haas F1 Team"),
    (50, "Oliver Bearman", "Haas F1 Team"),
]

CONSTRUCTORS_2024: list[str] = sorted({team for _, _, team in DRIVERS_2024})

CIRCUITS: list[dict[str, str]] = [
    {"circuit": circuit, "grand_prix": f"{keyword} Grand Prix"}
    for circuit, keyword in sorted(CIRCUIT_TO_GP_KEYWORD.items(), key=lambda kv: kv[1])
]
