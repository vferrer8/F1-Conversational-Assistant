import requests
import time
from typing import Dict, Any, List, Optional
from config import OPENF1_BASE_URL

class F1Client:
    def __init__(self, base_url: str = OPENF1_BASE_URL):
        self.base_url = base_url

    def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/{endpoint}"
        for i in range(5):
            r = requests.get(url, params=params)
            if r.status_code == 404:
                return []
            if r.status_code == 429:
                time.sleep(2 ** i)
                continue
            r.raise_for_status()
            return r.json()
        return []

    def get_laps(self, **kwargs) -> List[Dict[str, Any]]:
        """Returns lap data (sector times, lap duration) from OpenF1."""
        return self._get("laps", params=kwargs)
