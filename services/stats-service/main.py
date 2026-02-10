"""
Sports Tower - Stats Microservice

FastAPI microservice that provides NBA player stats via the nba_api library.
Runs as a separate process from the Next.js app and is called via REST.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from endpoints.games import router as games_router
from endpoints.boxscores import router as boxscores_router
from endpoints.players import router as players_router

load_dotenv()

app = FastAPI(
    title="Sports Tower Stats Service",
    description="NBA player stats microservice powered by nba_api",
    version="0.1.0",
)

# CORS configuration — defaults to localhost:3000 for local dev.
# Set ALLOWED_ORIGINS as a comma-separated list for production.
_default_origins = "http://localhost:3000"
_allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")
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
