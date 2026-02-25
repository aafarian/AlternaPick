"""Shared helpers for ESPN API clients (NBA, NCAAB).

Provides caching, rate limiting, HTTP connection pooling, and response parsing
so individual sport clients stay focused on endpoint-specific logic.
"""

import asyncio
import logging
import time

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory cache with per-entry TTL
# ---------------------------------------------------------------------------
CACHE_TTL_SECONDS = 30
FINAL_CACHE_TTL_SECONDS = 3600

_cache: dict[str, tuple[float, object, float]] = {}


def get_cached(key: str):
    """Return cached value if still valid, else None."""
    entry = _cache.get(key)
    if entry and (time.monotonic() - entry[0]) < entry[2]:
        return entry[1]
    return None


def set_cached(key: str, value, ttl: float = CACHE_TTL_SECONDS):
    """Store value in cache with current timestamp and TTL."""
    _cache[key] = (time.monotonic(), value, ttl)


# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
class EspnRateLimiter:
    """Async rate limiter with configurable minimum interval between calls."""

    def __init__(self, min_interval: float = 0.3):
        self.min_interval = min_interval
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call
            if elapsed < self.min_interval:
                await asyncio.sleep(self.min_interval - elapsed)
            self._last_call = time.monotonic()


# ---------------------------------------------------------------------------
# Shared httpx client (connection pooling across requests)
# ---------------------------------------------------------------------------
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """Return a shared httpx client for connection pooling."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=15.0)
    return _http_client


# ---------------------------------------------------------------------------
# ESPN response parsers
# ---------------------------------------------------------------------------
def parse_espn_status(status_type: str) -> str:
    """Map ESPN status type/state to our format."""
    t = status_type.lower()
    if t == "post":
        return "final"
    if t == "in":
        return "live"
    return "scheduled"


def parse_period(status: dict) -> int:
    """Extract period number from ESPN status dict."""
    period = status.get("period", 0)
    return period if isinstance(period, int) else 0


def parse_clock(status: dict) -> str:
    """Extract display clock from ESPN status dict."""
    clock = status.get("displayClock", "0:00")
    return clock if clock else "0:00"


# ---------------------------------------------------------------------------
# Stat value parsers
# ---------------------------------------------------------------------------
def parse_stat_value(val: str) -> tuple[int, int]:
    """Parse ESPN stat strings like '6-10' into (made, attempted)."""
    if not val or val == "-":
        return (0, 0)
    parts = val.split("-")
    if len(parts) == 2:
        try:
            return (int(parts[0]), int(parts[1]))
        except (ValueError, TypeError):
            return (0, 0)
    try:
        return (int(val), 0)
    except (ValueError, TypeError):
        return (0, 0)


def safe_int(val) -> int:
    """Safely convert a value to int."""
    if val is None or val == "-" or val == "":
        return 0
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0
