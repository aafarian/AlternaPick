from fastapi import APIRouter, HTTPException

from ..utils.nba_client import get_todays_scoreboard

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
