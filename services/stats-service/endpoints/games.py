from fastapi import APIRouter, HTTPException, Query

from utils.nba_client import get_todays_scoreboard, get_todays_scoreboard_cached

router = APIRouter(prefix="/games", tags=["games"])


@router.get("/today")
async def today_games(date: str = Query(default="")):
    """Get NBA games with scores and status.

    Pass ?date=YYYYMMDD to fetch games for a specific date. Defaults to today.
    """
    try:
        target_date = date.strip() if date.strip() else None
        games = await get_todays_scoreboard(target_date)
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch games from ESPN",
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
                "error": "Failed to fetch live games from ESPN",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )
