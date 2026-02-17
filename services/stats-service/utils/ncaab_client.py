"""
ESPN client for fetching NCAAB (men's college basketball) data.

Uses ESPN's free public API (no key required):
  - Scoreboard: site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard
  - Summary:    site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary

groups=50 filters to Division I only.
"""

import asyncio
import logging
import time
from datetime import date, datetime, timezone, timedelta

import httpx

# US Eastern: ESPN dates are in ET. Using a fixed UTC-5 offset is sufficient
# for date calculation (worst case we're off by 1 hour during DST transition,
# but the scoreboard date will still be correct for evening games).
_ET = timezone(timedelta(hours=-5))

logger = logging.getLogger(__name__)

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball"

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


# Conservative rate limiter — ESPN is generous but be respectful
class EspnRateLimiter:
    def __init__(self, min_interval: float = 1.0):
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


espn_rate_limiter = EspnRateLimiter(min_interval=0.3)


async def _espn_get(endpoint: str, params: dict | None = None) -> dict:
    """Make a rate-limited GET request to ESPN."""
    await espn_rate_limiter.acquire()
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{ESPN_BASE}{endpoint}",
            params=params or {},
        )
        response.raise_for_status()
        return response.json()


def _parse_espn_status(status_type: str, status_detail: str) -> str:
    """Map ESPN status type to our format."""
    t = status_type.lower()
    if t == "post":
        return "final"
    if t == "in":
        return "live"
    return "scheduled"


def _parse_period(status_detail: dict) -> int:
    """Extract period from ESPN status detail."""
    period = status_detail.get("period", 0)
    return period if isinstance(period, int) else 0


def _parse_clock(status_detail: dict) -> str:
    """Extract clock from ESPN status detail."""
    clock = status_detail.get("displayClock", "0:00")
    return clock if clock else "0:00"


async def get_todays_ncaab_games(target_date: str | None = None) -> list[dict]:
    """Fetch NCAAB games with scores and status from ESPN.

    Args:
        target_date: Date in YYYYMMDD format. Defaults to today.
    """
    today = target_date or datetime.now(_ET).strftime("%Y%m%d")
    cache_key = f"ncaab_games:{today}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _espn_get("/scoreboard", {
            "dates": today,
            "groups": "50",
            "limit": "200",
        })

        games = []
        for event in data.get("events", []):
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])

            if len(competitors) < 2:
                continue

            # ESPN lists home first, away second (or vice versa — check homeAway)
            home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
            away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])

            status = competition.get("status", event.get("status", {}))
            status_type = status.get("type", {}).get("state", "pre")
            status_detail = status.get("type", {}).get("detail", "")

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
                "status": _parse_espn_status(status_type, status_detail),
                "period": _parse_period(status),
                "clock": _parse_clock(status),
                "start_time": event.get("date", ""),
                "home_team_id": str(home_team_data.get("id", "")),
                "away_team_id": str(away_team_data.get("id", "")),
            })

        _set_cached(cache_key, games)
        return games
    except Exception as e:
        logger.error(f"Failed to fetch NCAAB games: {e}")
        raise


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


async def get_ncaab_boxscore(event_id: str) -> list[dict]:
    """Fetch player boxscore for an NCAAB game from ESPN summary."""
    cache_key = f"ncaab_boxscore:{event_id}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _espn_get("/summary", {"event": event_id})

        players = []
        boxscore = data.get("boxscore", {})

        for team_data in boxscore.get("players", []):
            team_info = team_data.get("team", {})
            team_name = team_info.get("displayName", team_info.get("name", ""))
            team_tricode = team_info.get("abbreviation", "")

            for stat_group in team_data.get("statistics", []):
                # Find column indices from the labels
                labels = [lbl.lower() for lbl in stat_group.get("labels", [])]

                for athlete in stat_group.get("athletes", []):
                    athlete_info = athlete.get("athlete", {})
                    stats_values = athlete.get("stats", [])

                    if not stats_values:
                        continue

                    # Build a label→value map
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

                    headshot = athlete_info.get("headshot", {}).get("href", "")

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
                        "plus_minus": 0,
                        "fouls": pf,
                    })

        # Determine TTL: long for final games
        ttl = CACHE_TTL_SECONDS
        game_status = data.get("header", {}).get("competitions", [{}])[0].get("status", {})
        status_type = game_status.get("type", {}).get("state", "")
        if _parse_espn_status(status_type, "") == "final":
            ttl = FINAL_CACHE_TTL_SECONDS

        _set_cached(cache_key, players, ttl)
        return players
    except Exception as e:
        logger.error(f"Failed to fetch NCAAB boxscore for event {event_id}: {e}")
        raise


def _safe_int(val) -> int:
    """Safely convert a value to int."""
    if val is None or val == "-" or val == "":
        return 0
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


async def get_team_roster(team_id: str) -> list[dict]:
    """Fetch team roster from ESPN. Returns list of {name, id}."""
    cache_key = f"ncaab_roster:{team_id}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _espn_get(f"/teams/{team_id}/roster")
        players = []
        for athlete in data.get("athletes", []):
            player_id = str(athlete.get("id", ""))
            display_name = athlete.get("displayName", athlete.get("fullName", ""))
            if player_id and display_name:
                players.append({
                    "name": display_name,
                    "id": player_id,
                })
        _set_cached(cache_key, players, 6 * 3600)  # Cache for 6 hours
        return players
    except Exception as e:
        logger.warning(f"Failed to fetch roster for team {team_id}: {e}")
        return []


async def get_all_ncaab_teams() -> dict[str, str]:
    """Fetch ALL Division I NCAAB teams from ESPN. Returns {display_name: espn_id}.

    Single API call, cached 24 hours. Covers ~360 teams so teamLogoUrl()
    works for any D-I team regardless of game schedule.
    """
    cache_key = "ncaab_all_teams"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _espn_get("/teams", {"limit": "400", "groups": "50"})

        teams: dict[str, str] = {}
        for team_entry in data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", []):
            team = team_entry.get("team", team_entry)
            team_id = str(team.get("id", ""))
            display_name = team.get("displayName", team.get("name", ""))
            if team_id and display_name:
                teams[display_name.lower()] = team_id
                # Also store short name for fuzzy matching
                short_name = team.get("shortDisplayName", "")
                if short_name:
                    teams[short_name.lower()] = team_id

        _set_cached(cache_key, teams, 24 * 3600)  # Cache for 24 hours
        return teams
    except Exception as e:
        logger.error(f"Failed to fetch NCAAB teams: {e}")
        raise


async def get_ncaab_player_mapping(team_ids: list[str] | None = None) -> dict[str, str]:
    """Get player name → ESPN player ID mapping.

    If team_ids is provided, fetch rosters for those specific teams.
    Otherwise, fetch rosters for all of today's game teams.
    """
    cache_key = f"ncaab_player_mapping:{','.join(sorted(team_ids)) if team_ids else 'today'}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    if team_ids is None:
        # Fall back to today's games
        games = await get_todays_ncaab_games()
        team_ids = list(set(
            game.get("home_team_id", "") for game in games
        ) | set(
            game.get("away_team_id", "") for game in games
        ))

    team_ids = [tid for tid in team_ids if tid]

    # Fetch rosters concurrently (batched to avoid hammering ESPN)
    sem = asyncio.Semaphore(10)

    async def _fetch(tid: str) -> list[dict]:
        async with sem:
            return await get_team_roster(tid)

    rosters = await asyncio.gather(*[_fetch(tid) for tid in team_ids])
    mapping: dict[str, str] = {}
    for roster in rosters:
        for player in roster:
            mapping[player["name"].lower()] = player["id"]

    _set_cached(cache_key, mapping, 3600)  # Cache for 1 hour
    return mapping


async def get_todays_ncaab_games_cached() -> list[dict]:
    """Cached version of get_todays_ncaab_games (30s TTL)."""
    return await get_todays_ncaab_games()


async def get_ncaab_boxscore_cached(event_id: str) -> list[dict]:
    """Cached version of get_ncaab_boxscore (30s TTL for live, 1hr for final)."""
    return await get_ncaab_boxscore(event_id)
