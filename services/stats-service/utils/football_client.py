"""
api-football client for team and player lookups.

Uses the direct api-football.com endpoint (v3.football.api-sports.io).
Sign up at https://dashboard.api-football.com for a free API key (100 req/day).

Endpoints used:
  - GET /teams?league={id}&season={season}   — all teams for a league
  - GET /players/squads?team={id}            — squad for a team

Game scores and player boxscores have been migrated to ESPN.
Free tier: 100 requests/day. We use a dedicated rate limiter.
"""

import asyncio
import logging
import os
import time
import unicodedata

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://v3.football.api-sports.io"
EPL_SEASON = 2024  # Free plan covers 2022-2024

# In-memory cache with TTL
_cache: dict[str, tuple[float, object, float]] = {}
CACHE_TTL_SECONDS = 30


def _get_cached(key: str):
    entry = _cache.get(key)
    if entry and (time.monotonic() - entry[0]) < entry[2]:
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
