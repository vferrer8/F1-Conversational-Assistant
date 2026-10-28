import sqlite3
import pandas as pd
from typing import List, Dict, Any, Optional
from config import DB_PATH

class F1Database:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def get_driver_by_number(self, driver_number: int) -> Optional[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM drivers WHERE driver_number = ?", (driver_number,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_driver_by_name(self, name_part: str) -> Optional[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM drivers WHERE full_name LIKE ?", (f"%{name_part}%",))
            row = cursor.fetchone()
            return dict(row) if row else None

    def query_race_results(self, year: int, circuit: Optional[str] = None) -> List[Dict[str, Any]]:
        query = "SELECT * FROM race_results WHERE year = ?"
        params = [year]
        if circuit:
            query += " AND circuit LIKE ?"
            params.append(f"%{circuit}%")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, tuple(params))
            return [dict(row) for row in cursor.fetchall()]

    def get_semantic_entity(self, term: str) -> Optional[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM semantic_mapping WHERE user_term = ?", (term.lower(),))
            row = cursor.fetchone()
            return dict(row) if row else None
