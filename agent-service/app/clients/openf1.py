import time
from typing import Any

import requests

from app.core.config import get_settings


class OpenF1Client:
    def __init__(self, base_url: str | None = None, timeout_s: float | None = None) -> None:
        settings = get_settings()
        self.base_url = base_url or settings.openf1_base_url
        self.timeout_s = timeout_s or settings.http_timeout_s

    def _get(self, endpoint: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        url = f"{self.base_url}/{endpoint}"
        for i in range(5):
            r = requests.get(url, params=params, timeout=self.timeout_s)
            if r.status_code == 404:
                return []
            if r.status_code == 429:
                time.sleep(2**i)
                continue
            r.raise_for_status()
            return r.json()
        return []

    def get_laps(self, **kwargs: Any) -> list[dict[str, Any]]:
        """Returns lap data (sector times, lap duration) from OpenF1."""
        return self._get("laps", params=kwargs)
