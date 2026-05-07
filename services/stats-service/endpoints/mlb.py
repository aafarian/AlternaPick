from fastapi import APIRouter, HTTPException, Query

from utils.mlb_client import (
    get_todays_mlb_games,
    get_todays_mlb_games_cached,
    get_mlb_boxscore,
    get_mlb_boxscore_cached,
)

router = APIRouter(prefix="/mlb", tags=["mlb"])


@router.get("/games/today")
async def today_mlb_games(date: str = Query(default="")):
    """Get MLB games with scores and status.

    Pass ?date=YYYYMMDD to fetch games for a specific date. Defaults to today.
    """
    try:
        target_date = date.strip() if date.strip() else None
        games = await get_todays_mlb_games(target_date)
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch MLB games",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/today/live")
async def today_mlb_games_live():
    """Get today's MLB games with cached scores (30s TTL)."""
    try:
        games = await get_todays_mlb_games_cached()
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch live MLB games",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/{event_id}/boxscore")
async def mlb_boxscore(event_id: str):
    """Get player stats for a specific MLB game."""
    try:
        players = await get_mlb_boxscore(event_id)
        return {"data": players, "count": len(players)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch boxscore for event {event_id}",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/{event_id}/boxscore/live")
async def mlb_boxscore_live(event_id: str):
    """Get cached player stats for a specific MLB game (30s TTL)."""
    try:
        players = await get_mlb_boxscore_cached(event_id)
        return {"data": players, "count": len(players)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch live boxscore for event {event_id}",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )
