from fastapi import APIRouter, HTTPException, Query

from utils.football_client import (
    get_todays_epl_fixtures,
    get_todays_epl_fixtures_cached,
    get_todays_la_liga_fixtures,
    get_todays_la_liga_fixtures_cached,
    get_fixture_player_stats,
    get_fixture_player_stats_cached,
    get_soccer_players_by_team_names,
    get_soccer_teams,
)

router = APIRouter(prefix="/soccer", tags=["soccer"])


@router.get("/games/today")
async def today_soccer_games(league: str = Query("epl", description="League key: epl or la_liga")):
    """Get today's soccer fixtures with scores and status."""
    try:
        if league == "la_liga":
            games = await get_todays_la_liga_fixtures()
        else:
            games = await get_todays_epl_fixtures()
        return {"data": games, "count": len(games)}
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
async def today_soccer_games_live(league: str = Query("epl", description="League key: epl or la_liga")):
    """Get today's soccer fixtures with cached scores (30s TTL)."""
    try:
        if league == "la_liga":
            games = await get_todays_la_liga_fixtures_cached()
        else:
            games = await get_todays_epl_fixtures_cached()
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
