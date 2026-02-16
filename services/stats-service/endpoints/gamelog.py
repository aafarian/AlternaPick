import asyncio
import logging
import time
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException, Query

from utils.rate_limiter import nba_rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/players", tags=["gamelog"])

# In-memory cache with 1-hour TTL and max 500 entries (LRU eviction)
_cache: dict[str, tuple[float, object]] = {}
_CACHE_TTL = 3600  # 1 hour
_CACHE_MAX_SIZE = 500


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and (time.monotonic() - entry[0]) < _CACHE_TTL:
        return entry[1]
    if entry:
        del _cache[key]
    return None


def _set_cached(key: str, value):
    # Evict oldest entries when cache is full
    if len(_cache) >= _CACHE_MAX_SIZE:
        oldest_key = min(_cache, key=lambda k: _cache[k][0])
        del _cache[oldest_key]
    _cache[key] = (time.monotonic(), value)


def _current_nba_season() -> str:
    """Auto-detect NBA season string: if month >= October use current year, else previous."""
    now = datetime.now()
    if now.month >= 10:
        return f"{now.year}-{str(now.year + 1)[-2:]}"
    return f"{now.year - 1}-{str(now.year)[-2:]}"


async def _fetch_nba_gamelog(player_id: str, last_n: int) -> dict:
    """Fetch NBA game log via nba_api."""
    await nba_rate_limiter.acquire()

    season = _current_nba_season()

    def _call():
        from nba_api.stats.endpoints.playergamelog import PlayerGameLog

        gl = PlayerGameLog(player_id=player_id, season=season, timeout=10)
        return gl.get_normalized_dict()

    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, _call)

    rows = data.get("PlayerGameLog", [])

    games = []
    for row in rows[:last_n]:
        games.append({
            "game_date": row.get("GAME_DATE", ""),
            "matchup": row.get("MATCHUP", ""),
            "result": row.get("WL", ""),
            "minutes": row.get("MIN", 0),
            "points": row.get("PTS", 0),
            "rebounds": row.get("REB", 0),
            "assists": row.get("AST", 0),
            "steals": row.get("STL", 0),
            "blocks": row.get("BLK", 0),
            "turnovers": row.get("TOV", 0),
            "threes_made": row.get("FG3M", 0),
            "field_goals": f"{row.get('FGM', 0)}-{row.get('FGA', 0)}",
            "free_throws": f"{row.get('FTM', 0)}-{row.get('FTA', 0)}",
            "plus_minus": row.get("PLUS_MINUS", 0),
        })

    # Compute season averages from the full log
    total_games = len(rows)
    averages = {
        "games_played": total_games,
        "minutes": 0,
        "points": 0,
        "rebounds": 0,
        "assists": 0,
        "steals": 0,
        "blocks": 0,
        "turnovers": 0,
        "threes_made": 0,
    }

    if total_games > 0:
        for row in rows:
            averages["minutes"] += row.get("MIN", 0) or 0
            averages["points"] += row.get("PTS", 0) or 0
            averages["rebounds"] += row.get("REB", 0) or 0
            averages["assists"] += row.get("AST", 0) or 0
            averages["steals"] += row.get("STL", 0) or 0
            averages["blocks"] += row.get("BLK", 0) or 0
            averages["turnovers"] += row.get("TOV", 0) or 0
            averages["threes_made"] += row.get("FG3M", 0) or 0

        for key in averages:
            if key != "games_played":
                averages[key] = round(averages[key] / total_games, 1)

    return {"games": games, "season_averages": averages}


async def _fetch_ncaab_gamelog(player_id: str, last_n: int) -> dict:
    """Fetch NCAAB game log via ESPN v3 athlete gamelog API."""
    url = (
        f"https://site.web.api.espn.com/apis/common/v3/sports/basketball"
        f"/mens-college-basketball/athletes/{player_id}/gamelog"
    )

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    # ESPN v3 structure:
    #   labels: ["MIN", "FG", "FG%", "3PT", "3P%", "FT", "FT%", "REB", "AST", "BLK", "STL", "PF", "TO", "PTS"]
    #   events: { "<eventId>": { gameDate, gameResult, atVs, opponent: { abbreviation }, ... } }
    #   seasonTypes[0].categories[0].events: [ { eventId, stats: ["31", "7-16", ...] } ]
    #   totals: ["666", "104-253", ...] (season totals matching labels)

    labels = data.get("labels", [])
    events_dict = data.get("events", {})
    season_types = data.get("seasonTypes", [])
    totals = data.get("totals", [])

    if not season_types or not labels:
        return {"games": [], "season_averages": {"games_played": 0}}

    # Get stat events from the first category
    categories = season_types[0].get("categories", [])
    if not categories:
        return {"games": [], "season_averages": {"games_played": 0}}

    stat_events = categories[0].get("events", [])

    # Build label-to-index map
    label_idx: dict[str, int] = {}
    for i, label in enumerate(labels):
        label_idx[label] = i

    def _safe_int(stats: list, key: str) -> int:
        idx = label_idx.get(key)
        if idx is None or idx >= len(stats):
            return 0
        try:
            return int(stats[idx])
        except (ValueError, TypeError):
            return 0

    def _safe_str(stats: list, key: str) -> str:
        idx = label_idx.get(key)
        if idx is None or idx >= len(stats):
            return "0"
        return str(stats[idx])

    def _safe_3pm(stats: list) -> int:
        """Extract 3-pointers made from '3PT' column (format: '3-8')."""
        raw = _safe_str(stats, "3PT")
        try:
            return int(raw.split("-")[0])
        except (ValueError, IndexError):
            return 0

    games = []
    for se in stat_events[:last_n]:
        event_id = se.get("eventId", "")
        stats = se.get("stats", [])
        ev = events_dict.get(event_id, {})
        opponent = ev.get("opponent", {})
        opp_abbr = opponent.get("abbreviation", "")
        at_vs = ev.get("atVs", "vs")
        matchup = f"{at_vs} {opp_abbr}"
        result = ev.get("gameResult", "")
        game_date = ev.get("gameDate", "")

        games.append({
            "game_date": game_date,
            "matchup": matchup,
            "result": result,
            "minutes": _safe_int(stats, "MIN"),
            "points": _safe_int(stats, "PTS"),
            "rebounds": _safe_int(stats, "REB"),
            "assists": _safe_int(stats, "AST"),
            "steals": _safe_int(stats, "STL"),
            "blocks": _safe_int(stats, "BLK"),
            "turnovers": _safe_int(stats, "TO"),
            "threes_made": _safe_3pm(stats),
            "field_goals": _safe_str(stats, "FG"),
            "free_throws": _safe_str(stats, "FT"),
            "plus_minus": 0,
        })

    # Compute season averages from totals + game count
    total_games = len(stat_events)
    averages: dict = {
        "games_played": total_games,
        "minutes": 0,
        "points": 0,
        "rebounds": 0,
        "assists": 0,
        "steals": 0,
        "blocks": 0,
        "turnovers": 0,
        "threes_made": 0,
    }

    if total_games > 0 and totals:
        # Use totals array (matches labels order) for accuracy
        averages["minutes"] = round(_safe_int(totals, "MIN") / total_games, 1)
        averages["points"] = round(_safe_int(totals, "PTS") / total_games, 1)
        averages["rebounds"] = round(_safe_int(totals, "REB") / total_games, 1)
        averages["assists"] = round(_safe_int(totals, "AST") / total_games, 1)
        averages["steals"] = round(_safe_int(totals, "STL") / total_games, 1)
        averages["blocks"] = round(_safe_int(totals, "BLK") / total_games, 1)
        averages["turnovers"] = round(_safe_int(totals, "TO") / total_games, 1)
        averages["threes_made"] = round(_safe_3pm(totals) / total_games, 1)

    return {"games": games, "season_averages": averages}


@router.get("/{player_id}/gamelog")
async def player_gamelog(
    player_id: str,
    sport: str = Query(default="nba"),
    last_n: int = Query(default=5, ge=1, le=20),
):
    """Fetch recent game log and season averages for a player."""
    cache_key = f"gamelog:{sport}:{player_id}:{last_n}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return {"data": cached}

    try:
        if sport == "nba":
            result = await _fetch_nba_gamelog(player_id, last_n)
        elif sport == "ncaab":
            result = await _fetch_ncaab_gamelog(player_id, last_n)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported sport: {sport}")

        _set_cached(cache_key, result)
        return {"data": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch gamelog for {player_id} ({sport}): {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Failed to fetch game log for player {player_id}",
                "message": str(e),
                "retry": "Try again in a few seconds",
            },
        )
