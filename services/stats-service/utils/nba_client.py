"""
ESPN client for fetching NBA data.

Uses ESPN's free public API (no key required):
  - Scoreboard: site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
  - Summary:    site.api.espn.com/apis/site/v2/sports/basketball/nba/summary

Replaces the nba_api library which required a 2.5s rate limit (NBA.com IP bans).
ESPN needs only 0.3s between calls, matching our NCAAB client pattern.
"""

import asyncio
import logging
import time
from datetime import datetime
from difflib import SequenceMatcher
from zoneinfo import ZoneInfo

import httpx

# US Eastern: ESPN dates are in ET (handles EST/EDT automatically)
_ET = ZoneInfo("America/New_York")

logger = logging.getLogger(__name__)

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"

# In-memory cache with TTL
_cache: dict[str, tuple[float, object, float]] = {}
CACHE_TTL_SECONDS = 30
FINAL_CACHE_TTL_SECONDS = 3600


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and (time.monotonic() - entry[0]) < entry[2]:
        return entry[1]
    return None


def _set_cached(key: str, value, ttl: float = CACHE_TTL_SECONDS):
    _cache[key] = (time.monotonic(), value, ttl)


class EspnRateLimiter:
    """Rate limiter for ESPN API calls — separate from NCAAB's instance."""

    def __init__(self, min_interval: float = 0.3):
        self.min_interval = min_interval
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call
            if elapsed < self.min_interval:
                await asyncio.sleep(self.min_interval - elapsed)
            self._last_call = time.monotonic()


espn_nba_rate_limiter = EspnRateLimiter(min_interval=0.3)


async def _espn_get(endpoint: str, params: dict | None = None) -> dict:
    """Make a rate-limited GET request to ESPN NBA API."""
    await espn_nba_rate_limiter.acquire()
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{ESPN_BASE}{endpoint}",
            params=params or {},
        )
        response.raise_for_status()
        return response.json()


def _parse_espn_status(status_type: str) -> str:
    """Map ESPN status type to our format."""
    t = status_type.lower()
    if t == "post":
        return "final"
    if t == "in":
        return "live"
    return "scheduled"


def _parse_period(status: dict) -> int:
    period = status.get("period", 0)
    return period if isinstance(period, int) else 0


def _parse_clock(status: dict) -> str:
    clock = status.get("displayClock", "0:00")
    return clock if clock else "0:00"


def _parse_stat_value(val: str) -> tuple[int, int]:
    """Parse ESPN stat strings like '6-10' into (made, attempted)."""
    if not val or val == "-":
        return (0, 0)
    parts = val.split("-")
    if len(parts) == 2:
        try:
            return (int(parts[0]), int(parts[1]))
        except (ValueError, TypeError):
            return (0, 0)
    try:
        return (int(val), 0)
    except (ValueError, TypeError):
        return (0, 0)


def _safe_int(val) -> int:
    """Safely convert a value to int."""
    if val is None or val == "-" or val == "":
        return 0
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


async def get_todays_scoreboard(target_date: str | None = None) -> list[dict]:
    """Fetch NBA scoreboard from ESPN.

    Args:
        target_date: Date in YYYYMMDD format. Defaults to today (ET).
    """
    today = target_date or datetime.now(_ET).strftime("%Y%m%d")
    cache_key = f"nba_games:{today}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _espn_get("/scoreboard", {"dates": today})

        games = []
        for event in data.get("events", []):
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])

            if len(competitors) < 2:
                continue

            home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
            away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])

            status = competition.get("status", event.get("status", {}))
            status_type = status.get("type", {}).get("state", "pre")
            status_detail = status.get("type", {})

            home_team_data = home.get("team", {})
            away_team_data = away.get("team", {})

            games.append({
                "game_id": str(event.get("id", "")),
                "home_team": home_team_data.get("displayName", home_team_data.get("name", "")),
                "home_tricode": home_team_data.get("abbreviation", ""),
                "away_team": away_team_data.get("displayName", away_team_data.get("name", "")),
                "away_tricode": away_team_data.get("abbreviation", ""),
                "home_score": int(home.get("score", "0") or "0"),
                "away_score": int(away.get("score", "0") or "0"),
                "status": _parse_espn_status(status_type),
                "period": _parse_period(status_detail),
                "clock": _parse_clock(status_detail),
                "start_time": event.get("date", ""),
                "home_team_id": str(home_team_data.get("id", "")),
                "away_team_id": str(away_team_data.get("id", "")),
            })

        _set_cached(cache_key, games)
        return games
    except Exception as e:
        logger.error(f"Failed to fetch NBA scoreboard: {e}")
        raise


async def get_boxscore(game_id: str) -> list[dict]:
    """Fetch player boxscore for an NBA game from ESPN summary."""
    cache_key = f"nba_boxscore:{game_id}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _espn_get("/summary", {"event": game_id})

        players = []
        boxscore = data.get("boxscore", {})

        for team_data in boxscore.get("players", []):
            team_info = team_data.get("team", {})
            team_name = team_info.get("displayName", team_info.get("name", ""))
            team_tricode = team_info.get("abbreviation", "")

            for stat_group in team_data.get("statistics", []):
                labels = [lbl.lower() for lbl in stat_group.get("labels", [])]

                for athlete in stat_group.get("athletes", []):
                    athlete_info = athlete.get("athlete", {})
                    stats_values = athlete.get("stats", [])

                    if not stats_values:
                        continue

                    # Build label→value map
                    stat_map = {}
                    for i, label in enumerate(labels):
                        if i < len(stats_values):
                            stat_map[label] = stats_values[i]

                    # Parse stats
                    minutes = stat_map.get("min", "0")
                    fg_made, fg_att = _parse_stat_value(stat_map.get("fg", "0-0"))
                    three_made, three_att = _parse_stat_value(stat_map.get("3pt", "0-0"))
                    ft_made, ft_att = _parse_stat_value(stat_map.get("ft", "0-0"))
                    oreb = _safe_int(stat_map.get("oreb", "0"))
                    dreb = _safe_int(stat_map.get("dreb", "0"))
                    reb = _safe_int(stat_map.get("reb", "0"))
                    ast = _safe_int(stat_map.get("ast", "0"))
                    stl = _safe_int(stat_map.get("stl", "0"))
                    blk = _safe_int(stat_map.get("blk", "0"))
                    to = _safe_int(stat_map.get("to", "0"))
                    pf = _safe_int(stat_map.get("pf", "0"))
                    pts = _safe_int(stat_map.get("pts", "0"))
                    plus_minus = _safe_int(stat_map.get("+/-", "0"))

                    players.append({
                        "player_name": athlete_info.get("displayName", ""),
                        "player_id": str(athlete_info.get("id", "")),
                        "team": team_name,
                        "team_tricode": team_tricode,
                        "minutes": str(minutes),
                        "points": pts,
                        "rebounds": reb,
                        "offensive_rebounds": oreb,
                        "defensive_rebounds": dreb,
                        "assists": ast,
                        "steals": stl,
                        "blocks": blk,
                        "turnovers": to,
                        "threes_made": three_made,
                        "threes_attempted": three_att,
                        "field_goals_made": fg_made,
                        "field_goals_attempted": fg_att,
                        "free_throws_made": ft_made,
                        "free_throws_attempted": ft_att,
                        "plus_minus": plus_minus,
                        "fouls": pf,
                    })

        # Longer TTL for final games
        ttl = CACHE_TTL_SECONDS
        game_status = data.get("header", {}).get("competitions", [{}])[0].get("status", {})
        status_type = game_status.get("type", {}).get("state", "")
        if _parse_espn_status(status_type) == "final":
            ttl = FINAL_CACHE_TTL_SECONDS

        _set_cached(cache_key, players, ttl)
        return players
    except Exception as e:
        logger.error(f"Failed to fetch NBA boxscore for game {game_id}: {e}")
        raise


async def get_todays_scoreboard_cached() -> list[dict]:
    """Cached version of get_todays_scoreboard (30s TTL)."""
    return await get_todays_scoreboard()


async def get_boxscore_cached(game_id: str) -> list[dict]:
    """Cached version of get_boxscore (30s TTL for live, 1hr for final)."""
    return await get_boxscore(game_id)


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
