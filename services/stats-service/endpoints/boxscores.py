from fastapi import APIRouter, HTTPException

from utils.nba_client import get_boxscore, get_boxscore_cached, get_todays_scoreboard, fuzzy_match_player

router = APIRouter(tags=["boxscores"])


@router.get("/games/{game_id}/boxscore")
async def game_boxscore(game_id: str):
    """Get full player box score for a specific game."""
    try:
        players = await get_boxscore(game_id)
        return {"data": players, "count": len(players)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch boxscore for game {game_id}",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/games/{game_id}/boxscore/live")
async def game_boxscore_live(game_id: str):
    """Get cached player box score for a specific game (30s TTL)."""
    try:
        players = await get_boxscore_cached(game_id)
        return {"data": players, "count": len(players)}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch live boxscore for game {game_id}",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )


@router.get("/players/{player_name}/stats")
async def player_stats(player_name: str):
    """Search today's games for a player by name (fuzzy match) and return their stats."""
    try:
        games = await get_todays_scoreboard()

        if not games:
            return {"data": None, "message": "No games today"}

        for game in games:
            if game["status"] not in ("live", "final"):
                continue
            try:
                players = await get_boxscore(game["game_id"])
                match = fuzzy_match_player(player_name, players)
                if match:
                    match["game_id"] = game["game_id"]
                    match["home_team"] = game["home_team"]
                    match["away_team"] = game["away_team"]
                    match["game_status"] = game["status"]
                    return {"data": match}
            except Exception:
                continue

        return {
            "data": None,
            "message": f"Player '{player_name}' not found in today's active games",
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Failed to search for player",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )
