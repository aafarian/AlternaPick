import asyncio
import time


class RateLimiter:
    """Enforces minimum delay between NBA API calls to avoid IP bans."""

    def __init__(self, min_interval: float = 2.5):
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


# Shared instance
nba_rate_limiter = RateLimiter(min_interval=2.5)
