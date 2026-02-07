"""
Sports Tower - Stats Microservice

FastAPI microservice that provides NBA player stats via the nba_api library.
Runs as a separate process from the Next.js app and is called via REST.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .endpoints.games import router as games_router
from .endpoints.boxscores import router as boxscores_router

load_dotenv()

app = FastAPI(
    title="Sports Tower Stats Service",
    description="NBA player stats microservice powered by nba_api",
    version="0.1.0",
)

# CORS configuration to allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
