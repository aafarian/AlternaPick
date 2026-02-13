"""
AlternaPick - Stats Microservice

FastAPI microservice that provides NBA player stats via the nba_api library.
Runs as a separate process from the Next.js app and is called via REST.
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from endpoints.games import router as games_router
from endpoints.boxscores import router as boxscores_router
from endpoints.players import router as players_router
from endpoints.soccer import router as soccer_router

load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AlternaPick Stats Service",
    description="NBA player stats microservice powered by nba_api",
    version="0.1.0",
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
