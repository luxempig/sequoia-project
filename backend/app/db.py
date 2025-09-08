from dotenv import load_dotenv
load_dotenv()

import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from app.config import get_settings

LOG = logging.getLogger("app.db")

def get_connection():
    """Create a new database connection."""
    s = get_settings()
    try:
        conn = psycopg2.connect(
            host=s.DB_HOST,
            port=s.DB_PORT,
            dbname=s.DB_NAME,
            user=s.DB_USER,
            password=s.DB_PASSWORD,
            sslmode="require",
            connect_timeout=10,
            application_name="sequoia-api"
        )
        # Set search path for schema
        with conn.cursor() as cur:
            cur.execute(f"SET search_path = {s.DB_SCHEMA}, public")
        conn.commit()
        return conn
    except psycopg2.Error as e:
        LOG.error(f"Database connection failed: {e}")
        raise

@contextmanager
def db_cursor(read_only: bool = False):
    """Context manager for database cursors with proper error handling."""
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if read_only:
            cur.execute("SET TRANSACTION READ ONLY")
            
        yield cur
        
        if not read_only:
            conn.commit()
            
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        LOG.error(f"Database error: {e}")
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        LOG.error(f"Unexpected error in database operation: {e}")
        raise
    finally:
        if cur:
            try:
                cur.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass

@contextmanager
def db_transaction():
    """Context manager for explicit database transactions."""
    conn = None
    try:
        conn = get_connection()
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur
                # Transaction will be committed automatically by 'with conn'
    except psycopg2.Error as e:
        LOG.error(f"Transaction failed: {e}")
        raise
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
