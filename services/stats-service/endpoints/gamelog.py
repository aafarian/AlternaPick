import logging
import time

import httpx
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/players", tags=["gamelog"])

# In-memory cache with 1-hour TTL and max 500 entries (LRU eviction)
_cache: dict[str, tuple[float, object]] = {}
_CACHE_TTL = 3600  # 1 hour
_CACHE_MAX_SIZE = 500

# Separate cache for ESPN athlete ID resolution (24h TTL)
_espn_id_cache: dict[str, tuple[float, str]] = {}
_ESPN_ID_CACHE_TTL = 86400  # 24 hours


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


async def _resolve_espn_nba_athlete_id(player_name: str) -> str:
    """Resolve an ESPN athlete ID from a player name using ESPN search API."""
    cache_key = player_name.lower().strip()
    entry = _espn_id_cache.get(cache_key)
    if entry and (time.monotonic() - entry[0]) < _ESPN_ID_CACHE_TTL:
        return entry[1]
    if entry:
        del _espn_id_cache[cache_key]

    url = (
        "https://site.api.espn.com/apis/common/v3/search"
        f"?query={player_name}&type=player&sport=basketball&league=nba"
    )

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    # Response: { "items": [ { "id": "12345", ... }, ... ] }
    items = data.get("items", [])
    if not items:
        raise ValueError(f"ESPN search returned no results for '{player_name}'")

    athlete_id = str(items[0].get("id", ""))
    if not athlete_id:
        raise ValueError(f"ESPN search result missing ID for '{player_name}'")

    # Evict oldest if cache is full
    if len(_espn_id_cache) >= _CACHE_MAX_SIZE:
        oldest = min(_espn_id_cache, key=lambda k: _espn_id_cache[k][0])
        del _espn_id_cache[oldest]
    _espn_id_cache[cache_key] = (time.monotonic(), athlete_id)

    return athlete_id


def _parse_espn_gamelog(data: dict, last_n: int) -> dict:
    """Shared parser for ESPN v3 athlete gamelog responses (NBA + NCAAB)."""
    labels = data.get("labels", [])
    events_dict = data.get("events", {})
    season_types = data.get("seasonTypes", [])
    totals = data.get("totals", [])

    if not season_types or not labels:
        return {"games": [], "season_averages": {"games_played": 0}}

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
        # Use pre-computed totals when available (NCAAB provides these)
        averages["minutes"] = round(_safe_int(totals, "MIN") / total_games, 1)
        averages["points"] = round(_safe_int(totals, "PTS") / total_games, 1)
        averages["rebounds"] = round(_safe_int(totals, "REB") / total_games, 1)
        averages["assists"] = round(_safe_int(totals, "AST") / total_games, 1)
        averages["steals"] = round(_safe_int(totals, "STL") / total_games, 1)
        averages["blocks"] = round(_safe_int(totals, "BLK") / total_games, 1)
        averages["turnovers"] = round(_safe_int(totals, "TO") / total_games, 1)
        averages["threes_made"] = round(_safe_3pm(totals) / total_games, 1)
    elif total_games > 0:
        # Fallback: compute averages from individual game stats (NBA doesn't provide totals)
        for se in stat_events:
            stats = se.get("stats", [])
            averages["minutes"] += _safe_int(stats, "MIN")
            averages["points"] += _safe_int(stats, "PTS")
            averages["rebounds"] += _safe_int(stats, "REB")
            averages["assists"] += _safe_int(stats, "AST")
            averages["steals"] += _safe_int(stats, "STL")
            averages["blocks"] += _safe_int(stats, "BLK")
            averages["turnovers"] += _safe_int(stats, "TO")
            averages["threes_made"] += _safe_3pm(stats)
        for key in averages:
            if key != "games_played":
                averages[key] = round(averages[key] / total_games, 1)

    return {"games": games, "season_averages": averages}


async def _fetch_espn_gamelog(league_path: str, athlete_id: str, last_n: int) -> dict:
    """Fetch game log from ESPN v3 gamelog endpoint for a given league path."""
    url = (
        f"https://site.web.api.espn.com/apis/common/v3/sports/basketball"
        f"/{league_path}/athletes/{athlete_id}/gamelog"
    )

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    return _parse_espn_gamelog(data, last_n)


async def _fetch_nba_gamelog(player_id: str, last_n: int, player_name: str | None = None) -> dict:
    """Fetch NBA game log via ESPN v3 API.

    Requires player_name to resolve the ESPN athlete ID (NBA.com IDs differ from ESPN IDs).
    """
    if not player_name:
        raise ValueError("player_name is required for NBA game log lookups")

    espn_id = await _resolve_espn_nba_athlete_id(player_name)
    return await _fetch_espn_gamelog("nba", espn_id, last_n)


async def _fetch_ncaab_gamelog(player_id: str, last_n: int) -> dict:
    """Fetch NCAAB game log via ESPN v3 athlete gamelog API."""
    return await _fetch_espn_gamelog("mens-college-basketball", player_id, last_n)


@router.get("/{player_id}/gamelog")
async def player_gamelog(
    player_id: str,
    sport: str = Query(default="nba"),
    last_n: int = Query(default=5, ge=1, le=20),
    player_name: str = Query(default=None),
):
    """Fetch recent game log and season averages for a player."""
    cache_key = f"gamelog:{sport}:{player_id}:{last_n}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return {"data": cached}

    try:
        if sport == "nba":
            result = await _fetch_nba_gamelog(player_id, last_n, player_name)
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
