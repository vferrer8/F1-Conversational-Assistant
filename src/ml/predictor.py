import os
import pickle

import numpy as np
import pandas as pd

from config import MODEL_SAVE_PATH
from src.ml.feature_resolver import FeatureResolver

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


class F1Predictor:
    def __init__(self) -> None:
        self.race_model_path = os.path.join(MODEL_SAVE_PATH, "race_pos_model.pkl")
        self._save_data = self._load_model(self.race_model_path)
        self.resolver = FeatureResolver()

        if self._save_data:
            self.model = self._save_data["model"]
        else:
            self.model = None

    def _load_model(self, path: str):
        if os.path.exists(path):
            with open(path, "rb") as f:
                return pickle.load(f)
        return None

    def predict_race_position(
        self,
        year: int,
        circuit: str,
        driver_number: int,
        grid: int,
        constructor: str,
    ) -> float:
        """
        Predice la posición final con el modelo XGBoost tuneado (10 features).
        Devuelve -1.0 si el modelo no está disponible.
        """
        if not self.model:
            return -1.0

        try:
            raw = self.resolver.resolve(year, circuit, driver_number, grid, constructor)
            X = pd.DataFrame([[raw[f] for f in FEATURES]], columns=FEATURES)
            pred = float(self.model.predict(X)[0])
            return round(float(np.clip(pred, 1, 25)), 1)
        except Exception as e:
            print(f"Prediction error: {e}")
            return -1.0
