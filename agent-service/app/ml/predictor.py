import logging
import pickle
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from app.core.config import get_settings
from app.ml.feature_resolver import FeatureResolver

logger = logging.getLogger(__name__)

FEATURES = [
    "grid",
    "driver_pos_before",
    "driver_wins_before",
    "constructor_pos_before",
    "driver_experience",
    "driver_age",
    "avg_finish_last3",
    "circuit_alt",
    "year",
    "season_progress",
]


@dataclass
class PredictionOutcome:
    position: float  # -1.0 si el modelo no está disponible o falla
    features: dict[str, float] = field(default_factory=dict)


class F1Predictor:
    def __init__(self, model_path: Path | None = None, resolver: FeatureResolver | None = None) -> None:
        self.race_model_path = model_path or get_settings().model_path
        self._save_data = self._load_model(self.race_model_path)
        self.resolver = resolver or FeatureResolver()
        self.model = self._save_data["model"] if self._save_data else None

    def _load_model(self, path: Path):
        if path.exists():
            with open(path, "rb") as f:
                return pickle.load(f)
        logger.warning("Modelo no encontrado en %s", path)
        return None

    def predict(
        self,
        year: int,
        circuit: str,
        driver_number: int,
        grid: int,
        constructor: str,
    ) -> PredictionOutcome:
        """Predice la posición final con el modelo XGBoost tuneado (10 features)."""
        if not self.model:
            return PredictionOutcome(position=-1.0)

        try:
            raw = self.resolver.resolve(year, circuit, driver_number, grid, constructor)
            X = pd.DataFrame([[raw[f] for f in FEATURES]], columns=FEATURES)
            pred = float(self.model.predict(X)[0])
            return PredictionOutcome(position=round(float(np.clip(pred, 1, 25)), 1), features=raw)
        except Exception:
            logger.exception("Prediction error")
            return PredictionOutcome(position=-1.0)

    def predict_race_position(self, *args, **kwargs) -> float:
        return self.predict(*args, **kwargs).position
