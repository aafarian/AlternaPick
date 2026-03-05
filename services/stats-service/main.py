"""
AlternaPick - Stats Microservice

FastAPI microservice that provides NBA player stats via the nba_api library.
Runs as a separate process from the Next.js app and is called via REST.
"""

import asyncio
import logging
import os

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from endpoints.games import router as games_router
from endpoints.boxscores import router as boxscores_router
from endpoints.players import router as players_router
from endpoints.soccer import router as soccer_router
from endpoints.ncaab import router as ncaab_router
from endpoints.gamelog import router as gamelog_router

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Background scoreboard refresh
#
# Instead of waiting for a request to trigger a cache miss → ESPN fetch,
# proactively refresh all sport scoreboards every 25s. This means the
# /games/today/live endpoints always hit a warm cache and respond instantly.
# ---------------------------------------------------------------------------
REFRESH_INTERVAL = 25  # seconds (just under the 30s cache TTL)

_refresh_task: asyncio.Task | None = None


async def _refresh_scoreboards():
    """Background loop that keeps scoreboard caches warm."""
    from utils.nba_client import get_todays_scoreboard
    from utils.ncaab_client import get_todays_ncaab_games
    from utils.soccer_espn_client import get_epl_scoreboard, get_la_liga_scoreboard

    while True:
        try:
            # Fetch all scoreboards in parallel — each one populates its own cache
            results = await asyncio.gather(
                get_todays_scoreboard(),
                get_todays_ncaab_games(),
                get_epl_scoreboard(),
                get_la_liga_scoreboard(),
                return_exceptions=True,
            )
            for i, r in enumerate(results):
                if isinstance(r, Exception):
                    sport = ["NBA", "NCAAB", "EPL", "La Liga"][i]
                    logger.warning(f"Background refresh failed for {sport}: {r}")
        except Exception as e:
            logger.warning(f"Background refresh error: {e}")

        await asyncio.sleep(REFRESH_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: warm caches + launch background refresh. Shutdown: cancel it."""
    global _refresh_task

    # Warm caches before accepting requests so the first poll doesn't hit cold ESPN fetches
    from utils.nba_client import get_todays_scoreboard
    from utils.ncaab_client import get_todays_ncaab_games
    from utils.soccer_espn_client import get_epl_scoreboard, get_la_liga_scoreboard

    await asyncio.gather(
        get_todays_scoreboard(),
        get_todays_ncaab_games(),
        get_epl_scoreboard(),
        get_la_liga_scoreboard(),
        return_exceptions=True,
    )

    _refresh_task = asyncio.create_task(_refresh_scoreboards())
    logger.info("Background scoreboard refresh started (every %ds)", REFRESH_INTERVAL)
    yield
    if _refresh_task:
        _refresh_task.cancel()
        try:
            await _refresh_task
        except asyncio.CancelledError:
            pass
    # Close the shared httpx client to release TCP connections
    from utils.espn_helpers import get_http_client
    client = get_http_client()
    if client and not client.is_closed:
        await client.aclose()
    logger.info("Background scoreboard refresh stopped")


app = FastAPI(
    title="AlternaPick Stats Service",
    description="NBA player stats microservice powered by nba_api",
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS configuration
#
# Environment variable: ALLOWED_ORIGINS
#   - Comma-separated list of allowed origins (e.g. "https://app.example.com,https://staging.example.com")
#   - Defaults to "http://localhost:3000" when not set (local development)
#   - In production, always set this to the exact origin(s) of the Next.js frontend
# ---------------------------------------------------------------------------
_default_origins = "http://localhost:3000"
_raw_origins = os.getenv("ALLOWED_ORIGINS")

if _raw_origins is None:
    logger.warning(
        "ALLOWED_ORIGINS is not set — defaulting to '%s'. "
        "Set ALLOWED_ORIGINS to your production frontend URL(s) before deploying.",
        _default_origins,
    )
    _raw_origins = _default_origins

_allowed_origins = [
    origin.strip()
    for origin in _raw_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint to verify the service is running."""
    return {"status": "ok"}


app.include_router(games_router)
app.include_router(boxscores_router)
app.include_router(players_router)
app.include_router(soccer_router)
app.include_router(ncaab_router)
app.include_router(gamelog_router)
