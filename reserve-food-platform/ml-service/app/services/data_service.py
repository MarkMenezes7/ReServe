import sqlite3
from app.config import DB_PATH


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = None  # Use tuple rows for performance
    return conn
