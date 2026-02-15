from fastapi import APIRouter, HTTPException, Query

from utils.ncaab_client import (
    get_todays_ncaab_games,
    get_todays_ncaab_games_cached,
    get_ncaab_boxscore,
    get_ncaab_boxscore_cached,
    get_ncaab_player_mapping,
    get_all_ncaab_teams,
)

router = APIRouter(prefix="/ncaab", tags=["ncaab"])


@router.get("/games/today")
async def today_ncaab_games(date: str = Query(default="")):
    """Get NCAAB games with scores and status.

    Pass ?date=YYYYMMDD to fetch games for a specific date. Defaults to today.
    """
    try:
        target_date = date.strip() if date.strip() else None
        games = await get_todays_ncaab_games(target_date)
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch NCAAB games",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/today/live")
async def today_ncaab_games_live():
    """Get today's NCAAB games with cached scores (30s TTL)."""
    try:
        games = await get_todays_ncaab_games_cached()
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch live NCAAB games",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/teams")
async def ncaab_teams():
    """Get all D-I NCAAB teams with ESPN IDs (cached 24hrs)."""
    try:
        teams = await get_all_ncaab_teams()
        return {"data": teams, "count": len(teams)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch NCAAB teams",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/players")
async def ncaab_players(team_ids: str = Query(default="")):
    """Get player name → ESPN ID mapping.

    Pass ?team_ids=123,456 to fetch rosters for specific teams.
    Omit for today's game teams.
    """
    try:
        ids = [tid.strip() for tid in team_ids.split(",") if tid.strip()] if team_ids else None
        mapping = await get_ncaab_player_mapping(ids)
        return {"data": mapping, "count": len(mapping)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to fetch NCAAB player mapping",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/{event_id}/boxscore")
async def ncaab_boxscore(event_id: str):
    """Get player stats for a specific NCAAB game."""
    try:
        players = await get_ncaab_boxscore(event_id)
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
async def ncaab_boxscore_live(event_id: str):
    """Get cached player stats for a specific NCAAB game (30s TTL)."""
    try:
        players = await get_ncaab_boxscore_cached(event_id)
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
