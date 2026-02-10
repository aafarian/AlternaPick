from fastapi import APIRouter, HTTPException

from utils.nba_client import get_todays_scoreboard, get_todays_scoreboard_cached

router = APIRouter(prefix="/games", tags=["games"])


@router.get("/today")
async def today_games():
    """Get today's NBA games with scores and status."""
    try:
        games = await get_todays_scoreboard()
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch games from NBA.com",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/today/live")
async def today_games_live():
    """Get today's NBA games with cached scores (30s TTL)."""
    try:
        games = await get_todays_scoreboard_cached()
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch live games from NBA.com",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )
