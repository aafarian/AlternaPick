"""
api-football client for fetching EPL fixture data.

Uses the direct api-football.com endpoint (v3.football.api-sports.io).
Sign up at https://dashboard.api-football.com for a free API key (100 req/day).

Endpoints used:
  - GET /fixtures?league=39&season=2024&date={today}  — today's EPL fixtures
  - GET /fixtures?id={id}                              — single fixture (score/status)
  - GET /fixtures/players?fixture={id}                 — player stats for a fixture

Free tier: 100 requests/day. We use a dedicated rate limiter.
"""

import asyncio
import logging
import os
import time
import unicodedata
from datetime import date

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://v3.football.api-sports.io"
EPL_LEAGUE_ID = 39
LA_LIGA_LEAGUE_ID = 140
EPL_SEASON = 2024  # EPL 2024-25 season

# In-memory cache with TTL
_cache: dict[str, tuple[float, object]] = {}
CACHE_TTL_SECONDS = 30
FINAL_CACHE_TTL_SECONDS = 3600


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and (time.monotonic() - entry[0]) < (entry[2] if len(entry) > 2 else CACHE_TTL_SECONDS):
        return entry[1]
    return None


def _set_cached(key: str, value, ttl: float = CACHE_TTL_SECONDS):
    _cache[key] = (time.monotonic(), value, ttl)


def _get_headers() -> dict:
    api_key = os.getenv("FOOTBALL_API_KEY", "")
    return {
        "x-apisports-key": api_key,
    }


# Rate limiter: api-football free tier = 100 req/day, ~10 req/min
class FootballRateLimiter:
    def __init__(self, min_interval: float = 6.0):
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


football_rate_limiter = FootballRateLimiter(min_interval=6.0)


async def _api_get(endpoint: str, params: dict) -> dict:
    """Make a rate-limited GET request to api-football."""
    await football_rate_limiter.acquire()
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{BASE_URL}{endpoint}",
            params=params,
            headers=_get_headers(),
        )
        response.raise_for_status()
        return response.json()


def _parse_fixture_status(status_short: str) -> str:
    """Map api-football short status to our status format."""
    live_statuses = {"1H", "2H", "HT", "ET", "BT", "P", "INT", "LIVE"}
    final_statuses = {"FT", "AET", "PEN", "AWD", "WO"}
    if status_short in live_statuses:
        return "live"
    if status_short in final_statuses:
        return "final"
    return "scheduled"


async def get_todays_fixtures(league_id: int = EPL_LEAGUE_ID) -> list[dict]:
    """Fetch today's fixtures for a given league with scores and status."""
    today = date.today().isoformat()
    cache_key = f"fixtures:{league_id}:{today}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _api_get("/fixtures", {
            "league": league_id,
            "season": EPL_SEASON,
            "date": today,
        })

        fixtures = []
        for f in data.get("response", []):
            fixture_info = f.get("fixture", {})
            teams = f.get("teams", {})
            goals = f.get("goals", {})
            status = fixture_info.get("status", {})

            fixtures.append({
                "game_id": str(fixture_info.get("id", "")),
                "home_team": teams.get("home", {}).get("name", ""),
                "home_tricode": "",
                "away_team": teams.get("away", {}).get("name", ""),
                "away_tricode": "",
                "home_score": goals.get("home") or 0,
                "away_score": goals.get("away") or 0,
                "status": _parse_fixture_status(status.get("short", "NS")),
                "period": _get_period(status),
                "clock": str(status.get("elapsed", 0) or 0) + "'",
                "start_time": fixture_info.get("date", ""),
            })

        _set_cached(cache_key, fixtures)
        return fixtures
    except Exception as e:
        logger.error(f"Failed to fetch EPL fixtures: {e}")
        raise


def _get_period(status: dict) -> int:
    """Derive period number from api-football status."""
    short = status.get("short", "NS")
    if short == "1H":
        return 1
    if short in ("HT", "2H"):
        return 2
    if short in ("ET", "BT", "P"):
        return 3
    if short in ("FT", "AET", "PEN"):
        return 2
    return 0


async def get_fixture_player_stats(fixture_id: str) -> list[dict]:
    """Fetch player stats for a completed/live fixture."""
    cache_key = f"epl_boxscore:{fixture_id}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _api_get("/fixtures/players", {
            "fixture": fixture_id,
        })

        players = []
        for team_data in data.get("response", []):
            team_name = team_data.get("team", {}).get("name", "")
            for player_entry in team_data.get("players", []):
                player_info = player_entry.get("player", {})
                stats_list = player_entry.get("statistics", [])
                if not stats_list:
                    continue
                # api-football returns a list of stat objects (one per position played)
                # Aggregate across all entries
                stats = _aggregate_player_stats(stats_list)

                players.append({
                    "player_name": player_info.get("name", ""),
                    "player_id": str(player_info.get("id", "")),
                    "team": team_name,
                    "team_tricode": "",
                    "minutes": str(stats.get("minutes", "0")),
                    "goals": stats.get("goals", 0),
                    "assists": stats.get("assists", 0),
                    "shots": stats.get("shots_total", 0),
                    "shots_on_target": stats.get("shots_on", 0),
                    "passes": stats.get("passes_total", 0),
                    "tackles": stats.get("tackles_total", 0),
                    "fouls_committed": stats.get("fouls_committed", 0),
                    "saves": stats.get("saves", 0),
                    # NBA-compatible fields (zero for soccer)
                    "points": 0,
                    "rebounds": 0,
                    "offensive_rebounds": 0,
                    "defensive_rebounds": 0,
                    "steals": 0,
                    "blocks": 0,
                    "turnovers": 0,
                    "threes_made": 0,
                    "threes_attempted": 0,
                    "field_goals_made": 0,
                    "field_goals_attempted": 0,
                    "free_throws_made": 0,
                    "free_throws_attempted": 0,
                    "plus_minus": 0,
                    "fouls": 0,
                })

        # Determine cache TTL: use long TTL for final games
        ttl = CACHE_TTL_SECONDS
        fixture_data = await _get_fixture_status(fixture_id)
        if fixture_data and fixture_data.get("status") == "final":
            ttl = FINAL_CACHE_TTL_SECONDS

        _set_cached(cache_key, players, ttl)
        return players
    except Exception as e:
        logger.error(f"Failed to fetch player stats for fixture {fixture_id}: {e}")
        raise


def _aggregate_player_stats(stats_list: list[dict]) -> dict:
    """Aggregate player stats across multiple stat entries."""
    result = {
        "minutes": 0,
        "goals": 0,
        "assists": 0,
        "shots_total": 0,
        "shots_on": 0,
        "passes_total": 0,
        "tackles_total": 0,
        "fouls_committed": 0,
        "saves": 0,
    }

    for s in stats_list:
        games = s.get("games", {})
        goals_data = s.get("goals", {})
        shots_data = s.get("shots", {})
        passes_data = s.get("passes", {})
        tackles_data = s.get("tackles", {})
        fouls_data = s.get("fouls", {})

        minutes_str = str(games.get("minutes") or "0")
        try:
            result["minutes"] += int(minutes_str.replace("'", ""))
        except (ValueError, TypeError):
            pass

        result["goals"] += goals_data.get("total") or 0
        result["assists"] += goals_data.get("assists") or 0
        result["shots_total"] += shots_data.get("total") or 0
        result["shots_on"] += shots_data.get("on") or 0
        result["passes_total"] += passes_data.get("total") or 0
        result["tackles_total"] += tackles_data.get("total") or 0
        result["fouls_committed"] += fouls_data.get("committed") or 0
        result["saves"] += s.get("goals", {}).get("saves") or 0

    return result


async def _get_fixture_status(fixture_id: str) -> dict | None:
    """Get fixture status (used internally for cache TTL decisions)."""
    cache_key = f"epl_fixture_status:{fixture_id}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _api_get("/fixtures", {"id": fixture_id})
        fixtures = data.get("response", [])
        if not fixtures:
            return None

        f = fixtures[0]
        status_short = f.get("fixture", {}).get("status", {}).get("short", "NS")
        result = {"status": _parse_fixture_status(status_short)}
        _set_cached(cache_key, result)
        return result
    except Exception:
        return None


LEAGUE_IDS = {
    "epl": 39,
    "la_liga": 140,
}


async def get_soccer_squad(team_id: int) -> list[dict]:
    """Fetch a team's squad from api-football. Cached 24 hours."""
    cache_key = f"soccer_squad:{team_id}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _api_get("/players/squads", {"team": team_id})
        players = []
        for team_data in data.get("response", []):
            for p in team_data.get("players", []):
                players.append({
                    "id": str(p.get("id", "")),
                    "name": p.get("name", ""),
                    "number": p.get("number"),
                    "position": p.get("position", ""),
                })
        _set_cached(cache_key, players, 86400)  # 24h cache
        return players
    except Exception as e:
        logger.error(f"Failed to fetch squad for team {team_id}: {e}")
        raise


async def get_soccer_teams(league: str) -> list[dict]:
    """Fetch all teams for a league. Cached 24 hours."""
    league_id = LEAGUE_IDS.get(league)
    if not league_id:
        return []

    cache_key = f"soccer_teams:{league}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _api_get("/teams", {"league": league_id, "season": EPL_SEASON})
        teams = []
        for t in data.get("response", []):
            team = t.get("team", {})
            teams.append({
                "id": str(team.get("id", "")),
                "name": team.get("name", ""),
            })
        _set_cached(cache_key, teams, 86400)  # 24h cache
        return teams
    except Exception as e:
        logger.error(f"Failed to fetch teams for {league}: {e}")
        raise


async def get_soccer_players_by_team_names(
    team_names: list[str], league: str
) -> dict[str, str]:
    """
    Given team names (from Odds API), find matching api-football teams,
    fetch their squads, and return {player_name: player_id} mapping.
    """
    all_teams = await get_soccer_teams(league)

    def normalize(s: str) -> str:
        # Strip diacritics: Atlético → Atletico, Almería → Almeria
        s = unicodedata.normalize("NFD", s)
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        s = s.lower().replace(".", "").strip()
        # Strip common prefixes/suffixes: "Athletic Club" → "athletic",
        # "Real Sociedad de Futbol" → "real sociedad"
        for token in [
            "fc", "cf", "ud", "sd", "cd", "club", "sc", "rc",
            "de futbol", "de football",
        ]:
            s = s.replace(f" {token} ", " ").replace(f" {token}", "").replace(f"{token} ", "")
        # Normalize "de" as a separator: "Real de Madrid" → "Real Madrid"
        s = s.replace(" de ", " ")
        return " ".join(s.split())  # collapse whitespace

    # Match Odds API team names to api-football team IDs
    matched_ids: list[int] = []
    unmatched_teams: list[str] = []
    for odds_name in team_names:
        norm = normalize(odds_name)
        found = False
        for t in all_teams:
            t_norm = normalize(t["name"])
            if t_norm == norm or norm in t_norm or t_norm in norm:
                matched_ids.append(int(t["id"]))
                found = True
                break
        if not found:
            unmatched_teams.append(odds_name)

    if unmatched_teams:
        api_names = [t["name"] for t in all_teams]
        logger.warning(
            f"[{league}] Unmatched teams: {unmatched_teams}. "
            f"API team names: {api_names}"
        )

    # Fetch squads for matched teams
    player_map: dict[str, str] = {}
    for team_id in matched_ids:
        try:
            squad = await get_soccer_squad(team_id)
            for p in squad:
                player_map[p["name"]] = p["id"]
        except Exception:
            pass

    return player_map


async def get_todays_epl_fixtures() -> list[dict]:
    """Fetch today's EPL fixtures (convenience wrapper)."""
    return await get_todays_fixtures(EPL_LEAGUE_ID)


async def get_todays_la_liga_fixtures() -> list[dict]:
    """Fetch today's La Liga fixtures."""
    return await get_todays_fixtures(LA_LIGA_LEAGUE_ID)



async def get_todays_epl_fixtures_cached() -> list[dict]:
    """Cached version of get_todays_epl_fixtures (30s TTL)."""
    return await get_todays_epl_fixtures()


async def get_todays_la_liga_fixtures_cached() -> list[dict]:
    """Cached version of get_todays_la_liga_fixtures (30s TTL)."""
    return await get_todays_la_liga_fixtures()


async def get_fixture_player_stats_cached(fixture_id: str) -> list[dict]:
    """Cached version of get_fixture_player_stats (30s TTL for live, 1hr for final)."""
    return await get_fixture_player_stats(fixture_id)
