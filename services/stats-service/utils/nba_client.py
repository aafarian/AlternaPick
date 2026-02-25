import asyncio
import logging
import time
from difflib import SequenceMatcher

from utils.rate_limiter import nba_rate_limiter

logger = logging.getLogger(__name__)

# In-memory cache with TTL for live endpoints
_cache: dict[str, tuple[float, object]] = {}
CACHE_TTL_SECONDS = 30


def _get_cached(key: str):
    """Return cached value if still valid, else None."""
    entry = _cache.get(key)
    if entry and (time.monotonic() - entry[0]) < CACHE_TTL_SECONDS:
        return entry[1]
    return None


def _set_cached(key: str, value):
    """Store value in cache with current timestamp."""
    _cache[key] = (time.monotonic(), value)


NBA_API_TIMEOUT = 15  # seconds — must exceed rate limiter queue wait


async def _run_sync(func, *args):
    """Run a synchronous nba_api call in a thread pool with timeout."""
    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, func, *args),
        timeout=NBA_API_TIMEOUT,
    )


async def get_todays_scoreboard() -> list[dict]:
    """Fetch today's NBA scoreboard. Returns list of game dicts."""
    await nba_rate_limiter.acquire()
    try:
        from nba_api.live.nba.endpoints import scoreboard

        sb = await _run_sync(scoreboard.ScoreBoard)
        games_data = sb.get_dict()
        raw_games = games_data.get("scoreboard", {}).get("games", [])

        games = []
        for g in raw_games:
            games.append(
                {
                    "game_id": g.get("gameId", ""),
                    "home_team": g.get("homeTeam", {}).get("teamName", ""),
                    "home_tricode": g.get("homeTeam", {}).get("teamTricode", ""),
                    "away_team": g.get("awayTeam", {}).get("teamName", ""),
                    "away_tricode": g.get("awayTeam", {}).get("teamTricode", ""),
                    "home_score": g.get("homeTeam", {}).get("score", 0),
                    "away_score": g.get("awayTeam", {}).get("score", 0),
                    "status": _parse_game_status(g),
                    "period": g.get("period", 0),
                    "clock": g.get("gameClock", ""),
                    "start_time": g.get("gameTimeUTC", ""),
                }
            )
        return games
    except Exception as e:
        logger.error(f"Failed to fetch scoreboard: {e}")
        raise


async def get_boxscore(game_id: str) -> list[dict]:
    """Fetch box score for a specific game. Returns list of player stat dicts."""
    await nba_rate_limiter.acquire()
    try:
        from nba_api.live.nba.endpoints import boxscore

        bs = await _run_sync(boxscore.BoxScore, game_id)
        data = bs.get_dict()
        game = data.get("game", {})

        players = []
        for side in ["homeTeam", "awayTeam"]:
            team_data = game.get(side, {})
            team_name = team_data.get("teamName", "")
            team_tricode = team_data.get("teamTricode", "")

            for p in team_data.get("players", []):
                stats = p.get("statistics", {})
                players.append(
                    {
                        "player_name": p.get("name", ""),
                        "player_id": str(p.get("personId", "")),
                        "team": team_name,
                        "team_tricode": team_tricode,
                        "minutes": stats.get("minutesCalculated", "PT00M"),
                        "points": stats.get("points", 0),
                        "rebounds": stats.get("reboundsTotal", 0),
                        "offensive_rebounds": stats.get("reboundsOffensive", 0),
                        "defensive_rebounds": stats.get("reboundsDefensive", 0),
                        "assists": stats.get("assists", 0),
                        "steals": stats.get("steals", 0),
                        "blocks": stats.get("blocks", 0),
                        "turnovers": stats.get("turnovers", 0),
                        "threes_made": stats.get("threePointersMade", 0),
                        "threes_attempted": stats.get("threePointersAttempted", 0),
                        "field_goals_made": stats.get("fieldGoalsMade", 0),
                        "field_goals_attempted": stats.get(
                            "fieldGoalsAttempted", 0
                        ),
                        "free_throws_made": stats.get("freeThrowsMade", 0),
                        "free_throws_attempted": stats.get(
                            "freeThrowsAttempted", 0
                        ),
                        "plus_minus": stats.get("plusMinusPoints", 0),
                        "fouls": stats.get("foulsPersonal", 0),
                    }
                )
        return players
    except Exception as e:
        logger.error(f"Failed to fetch boxscore for game {game_id}: {e}")
        raise


async def get_todays_scoreboard_cached() -> list[dict]:
    """Cached version of get_todays_scoreboard (30s TTL)."""
    cached = _get_cached("scoreboard")
    if cached is not None:
        return cached
    result = await get_todays_scoreboard()
    _set_cached("scoreboard", result)
    return result


async def get_boxscore_cached(game_id: str) -> list[dict]:
    """Cached version of get_boxscore (30s TTL)."""
    key = f"boxscore:{game_id}"
    cached = _get_cached(key)
    if cached is not None:
        return cached
    result = await get_boxscore(game_id)
    _set_cached(key, result)
    return result


def fuzzy_match_player(name: str, candidates: list[dict], threshold: float = 0.6) -> dict | None:
    """Find the best fuzzy match for a player name."""
    name_lower = name.lower()
    best_match = None
    best_score = 0.0

    for player in candidates:
        candidate = player.get("player_name", "").lower()
        score = SequenceMatcher(None, name_lower, candidate).ratio()
        if score > best_score and score >= threshold:
            best_score = score
            best_match = player

    return best_match


def _parse_game_status(game: dict) -> str:
    status = game.get("gameStatus", 1)
    if status == 1:
        return "scheduled"
    elif status == 2:
        return "live"
    elif status == 3:
        return "final"
    return "scheduled"
