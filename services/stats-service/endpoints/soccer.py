from fastapi import APIRouter, HTTPException, Query

from utils.soccer_espn_client import (
    get_epl_scoreboard,
    get_epl_scoreboard_cached,
    get_la_liga_scoreboard,
    get_la_liga_scoreboard_cached,
    get_copa_del_rey_scoreboard,
    get_copa_del_rey_scoreboard_cached,
    get_soccer_fixture_by_id,
    get_soccer_boxscore,
    get_soccer_boxscore_cached,
)
from utils.football_client import (
    get_soccer_players_by_team_names,
    get_soccer_teams,
)

router = APIRouter(prefix="/soccer", tags=["soccer"])


@router.get("/games/today")
async def today_soccer_games(
    league: str = Query("epl", description="League key: epl, la_liga, or copa_del_rey"),
    date: str = Query(default="", description="Date in YYYYMMDD format (defaults to today)"),
):
    """Get soccer fixtures with scores and status.

    Pass ?date=YYYYMMDD to fetch fixtures for a specific date. Defaults to today.
    """
    try:
        target_date = date.strip() if date.strip() else None
        if target_date and (len(target_date) != 8 or not target_date.isdigit()):
            raise HTTPException(status_code=400, detail="date must be YYYYMMDD")
        if league == "la_liga":
            games = await get_la_liga_scoreboard(target_date)
        elif league == "copa_del_rey":
            games = await get_copa_del_rey_scoreboard(target_date)
        else:
            games = await get_epl_scoreboard(target_date)
        return {"data": games, "count": len(games)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch {league} fixtures",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/today/live")
async def today_soccer_games_live(league: str = Query("epl", description="League key: epl, la_liga, or copa_del_rey")):
    """Get today's soccer fixtures with cached scores (30s TTL)."""
    try:
        if league == "la_liga":
            games = await get_la_liga_scoreboard_cached()
        elif league == "copa_del_rey":
            games = await get_copa_del_rey_scoreboard_cached()
        else:
            games = await get_epl_scoreboard_cached()
        return {"data": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch live {league} fixtures",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/teams")
async def soccer_teams(league: str = Query(..., description="League key: epl or la_liga")):
    """Get all teams for a soccer league with api-football IDs."""
    try:
        teams = await get_soccer_teams(league)
        return {"data": teams, "count": len(teams)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"error": f"Failed to fetch teams for {league}", "message": str(e)},
        )


@router.get("/players")
async def soccer_players(
    team_names: str = Query(..., description="Comma-separated team names"),
    league: str = Query(..., description="League key: epl or la_liga"),
):
    """Get player name -> api-football ID mapping for given teams."""
    try:
        names = [n.strip() for n in team_names.split(",") if n.strip()]
        player_map = await get_soccer_players_by_team_names(names, league)
        return {"data": player_map, "count": len(player_map)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"error": "Failed to fetch soccer players", "message": str(e)},
        )


@router.get("/games/{fixture_id}")
async def soccer_fixture(fixture_id: str):
    """Get a single fixture by ESPN event ID (score, status, teams)."""
    try:
        fixture = await get_soccer_fixture_by_id(fixture_id)
        if fixture is None:
            raise HTTPException(status_code=404, detail=f"Fixture {fixture_id} not found")
        return {"data": fixture}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch fixture {fixture_id}",
                "message": str(e),
            },
        )


@router.get("/games/{fixture_id}/boxscore")
async def epl_boxscore(fixture_id: str):
    """Get player stats for a specific soccer fixture from ESPN."""
    try:
        players = await get_soccer_boxscore(fixture_id)
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
    """Get cached player stats for a specific soccer fixture (30s TTL)."""
    try:
        players = await get_soccer_boxscore_cached(fixture_id)
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
