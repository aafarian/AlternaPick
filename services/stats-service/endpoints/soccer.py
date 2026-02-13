from fastapi import APIRouter, HTTPException

from utils.football_client import (
    get_todays_epl_fixtures,
    get_todays_epl_fixtures_cached,
    get_fixture_player_stats,
    get_fixture_player_stats_cached,
)

router = APIRouter(prefix="/soccer", tags=["soccer"])


@router.get("/games/today")
async def today_epl_games():
    """Get today's EPL fixtures with scores and status."""
    try:
        games = await get_todays_epl_fixtures()
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch EPL fixtures",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/today/live")
async def today_epl_games_live():
    """Get today's EPL fixtures with cached scores (30s TTL)."""
    try:
        games = await get_todays_epl_fixtures_cached()
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch live EPL fixtures",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/{fixture_id}/boxscore")
async def epl_boxscore(fixture_id: str):
    """Get player stats for a specific EPL fixture."""
    try:
        players = await get_fixture_player_stats(fixture_id)
        return {"data": players, "count": len(players)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch boxscore for fixture {fixture_id}",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/{fixture_id}/boxscore/live")
async def epl_boxscore_live(fixture_id: str):
    """Get cached player stats for a specific EPL fixture (30s TTL)."""
    try:
        players = await get_fixture_player_stats_cached(fixture_id)
        return {"data": players, "count": len(players)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch live boxscore for fixture {fixture_id}",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )
