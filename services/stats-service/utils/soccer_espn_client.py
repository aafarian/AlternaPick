"""
ESPN client for fetching EPL and La Liga data.

Uses ESPN's free public API (no key required):
  - Scoreboard: site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard
  - Summary:    site.api.espn.com/apis/site/v2/sports/soccer/{slug}/summary

Replaces api-football which is limited to 2022-2024 seasons on the free plan.
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from utils.espn_helpers import (
    EspnRateLimiter,
    get_cached,
    set_cached,
    espn_get_with_retry,
    parse_espn_status,
    parse_period,
    parse_clock,
    safe_int,
    CACHE_TTL_SECONDS,
    FINAL_CACHE_TTL_SECONDS,
)

_ET = ZoneInfo("America/New_York")

logger = logging.getLogger(__name__)

ESPN_EPL = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1"
ESPN_LA_LIGA = "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1"
ESPN_COPA_DEL_REY = "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.copa_del_rey"

ESPN_LEAGUE_URLS = {
    "eng.1": ESPN_EPL,
    "esp.1": ESPN_LA_LIGA,
    "esp.copa_del_rey": ESPN_COPA_DEL_REY,
}

# Separate rate limiter so soccer doesn't serialize against NBA/NCAAB
_rate_limiter = EspnRateLimiter(min_interval=0.3)


async def _espn_get(base_url: str, endpoint: str, params: dict | None = None) -> dict:
    """Make a rate-limited GET request to ESPN soccer API with retry."""
    return await espn_get_with_retry(
        _rate_limiter,
        f"{base_url}{endpoint}",
        params,
    )


def _parse_scoreboard(data: dict) -> list[dict]:
    """Parse ESPN scoreboard response into StatsGame-shaped dicts."""
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
            "status": parse_espn_status(status_type),
            "period": parse_period(status),
            "clock": parse_clock(status),
            "start_time": event.get("date", ""),
        })

    return games


async def _get_scoreboard(base_url: str, cache_prefix: str, target_date: str | None = None) -> list[dict]:
    """Fetch scoreboard for an ESPN soccer league.

    Args:
        base_url: ESPN league base URL.
        cache_prefix: Cache key prefix (e.g. "epl_games").
        target_date: Date in YYYYMMDD format. Defaults to today (ET).
    """
    today = target_date or datetime.now(_ET).strftime("%Y%m%d")
    cache_key = f"{cache_prefix}:{today}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _espn_get(base_url, "/scoreboard", {"dates": today})
        games = _parse_scoreboard(data)
        set_cached(cache_key, games)
        return games
    except Exception as e:
        logger.error(f"Failed to fetch {cache_prefix} scoreboard: {e}")
        raise


async def get_epl_scoreboard(target_date: str | None = None) -> list[dict]:
    """Fetch EPL games from ESPN for a given date (YYYYMMDD)."""
    return await _get_scoreboard(ESPN_EPL, "epl_games", target_date)


async def get_la_liga_scoreboard(target_date: str | None = None) -> list[dict]:
    """Fetch La Liga games from ESPN for a given date (YYYYMMDD)."""
    return await _get_scoreboard(ESPN_LA_LIGA, "la_liga_games", target_date)


async def get_copa_del_rey_scoreboard(target_date: str | None = None) -> list[dict]:
    """Fetch Copa del Rey games from ESPN for a given date (YYYYMMDD)."""
    return await _get_scoreboard(ESPN_COPA_DEL_REY, "copa_del_rey_games", target_date)


async def get_epl_scoreboard_cached() -> list[dict]:
    """Cached version of get_epl_scoreboard (30s TTL)."""
    return await get_epl_scoreboard()


async def get_la_liga_scoreboard_cached() -> list[dict]:
    """Cached version of get_la_liga_scoreboard (30s TTL)."""
    return await get_la_liga_scoreboard()


async def get_copa_del_rey_scoreboard_cached() -> list[dict]:
    """Cached version of get_copa_del_rey_scoreboard (30s TTL)."""
    return await get_copa_del_rey_scoreboard()


def _stat_val(stats_list: list[dict], name: str) -> int:
    """Extract a stat value from ESPN's per-player stats list by name."""
    for s in stats_list:
        if s.get("name") == name:
            return safe_int(s.get("value", 0))
    return 0


async def get_soccer_boxscore(event_id: str, league: str = "eng.1") -> list[dict]:
    """Fetch player boxscore for a soccer game from ESPN summary.

    Args:
        event_id: ESPN event ID.
        league: ESPN league slug ("eng.1" for EPL, "esp.1" for La Liga).
    """
    cache_key = f"soccer_boxscore:{event_id}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    base_url = ESPN_LEAGUE_URLS.get(league, ESPN_EPL)

    try:
        data = await _espn_get(base_url, "/summary", {"event": event_id})

        # Determine game status to decide DNP and cache TTL
        header = data.get("header", {})
        competitions = header.get("competitions", [{}])
        game_state = ""
        if competitions:
            status = competitions[0].get("status", {})
            game_state = status.get("type", {}).get("state", "")
        is_final = parse_espn_status(game_state) == "final"

        players = []
        for roster in data.get("rosters", []):
            team_info = roster.get("team", {})
            team_name = team_info.get("displayName", team_info.get("name", ""))
            team_tricode = team_info.get("abbreviation", "")

            for entry in roster.get("roster", []):
                athlete = entry.get("athlete", {})
                stats = entry.get("stats", [])
                is_active = entry.get("active", False)
                is_sub = not entry.get("starter", False)
                appearances = _stat_val(stats, "appearances") if stats else 0
                sub_ins = _stat_val(stats, "subIns") if stats else 0

                # DNP: only mark when game is final and player never entered.
                # During live games, bench players who haven't subbed in yet
                # should show 0 stats but not be flagged DNP.
                is_dnp = False
                if not is_active or not stats:
                    is_dnp = True
                elif is_final and is_sub and appearances == 0 and sub_ins == 0:
                    is_dnp = True

                if is_dnp:
                    players.append({
                        "player_name": athlete.get("displayName", ""),
                        "player_id": str(athlete.get("id", "")),
                        "team": team_name,
                        "team_tricode": team_tricode,
                        "minutes": "0",
                        "goals": 0,
                        "assists": 0,
                        "shots": 0,
                        "shots_on_target": 0,
                        "passes": 0,
                        "tackles": 0,
                        "fouls_committed": 0,
                        "saves": 0,
                        # NBA-compatible fields (zero for soccer)
                        "points": 0, "rebounds": 0, "offensive_rebounds": 0,
                        "defensive_rebounds": 0, "steals": 0, "blocks": 0,
                        "turnovers": 0, "threes_made": 0, "threes_attempted": 0,
                        "field_goals_made": 0, "field_goals_attempted": 0,
                        "free_throws_made": 0, "free_throws_attempted": 0,
                        "plus_minus": 0, "fouls": 0,
                        "dnp": True,
                    })
                    continue

                players.append({
                    "player_name": athlete.get("displayName", ""),
                    "player_id": str(athlete.get("id", "")),
                    "team": team_name,
                    "team_tricode": team_tricode,
                    "minutes": "90",  # ESPN doesn't provide minutes per player
                    "goals": _stat_val(stats, "totalGoals"),
                    "assists": _stat_val(stats, "goalAssists"),
                    "shots": _stat_val(stats, "totalShots"),
                    "shots_on_target": _stat_val(stats, "shotsOnTarget"),
                    "passes": 0,  # Not available from ESPN
                    "tackles": 0,  # Not available from ESPN
                    "fouls_committed": _stat_val(stats, "foulsCommitted"),
                    "saves": _stat_val(stats, "saves"),
                    # NBA-compatible fields (zero for soccer)
                    "points": 0, "rebounds": 0, "offensive_rebounds": 0,
                    "defensive_rebounds": 0, "steals": 0, "blocks": 0,
                    "turnovers": 0, "threes_made": 0, "threes_attempted": 0,
                    "field_goals_made": 0, "field_goals_attempted": 0,
                    "free_throws_made": 0, "free_throws_attempted": 0,
                    "plus_minus": 0, "fouls": 0,
                    "dnp": False,
                })

        # Longer TTL for final games
        ttl = FINAL_CACHE_TTL_SECONDS if is_final else CACHE_TTL_SECONDS

        if not players:
            logger.warning(f"Empty player stats for soccer event {event_id}")

        set_cached(cache_key, players, ttl)
        return players
    except Exception as e:
        logger.error(f"Failed to fetch soccer boxscore for event {event_id}: {e}")
        raise


async def get_soccer_boxscore_cached(event_id: str, league: str = "eng.1") -> list[dict]:
    """Cached version of get_soccer_boxscore."""
    return await get_soccer_boxscore(event_id, league)


async def get_soccer_fixture_by_id(event_id: str, league: str = "eng.1") -> dict | None:
    """Fetch a single soccer game by ESPN event ID via the summary endpoint.

    Args:
        event_id: ESPN event ID.
        league: ESPN league slug ("eng.1" for EPL, "esp.1" for La Liga).
    """
    cache_key = f"soccer_fixture:{event_id}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    base_url = ESPN_LEAGUE_URLS.get(league, ESPN_EPL)

    try:
        data = await _espn_get(base_url, "/summary", {"event": event_id})

        header = data.get("header", {})
        competitions = header.get("competitions", [{}])
        if not competitions:
            return None

        comp = competitions[0]
        competitors = comp.get("competitors", [])
        if len(competitors) < 2:
            return None

        home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
        away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])

        status = comp.get("status", {})
        status_type = status.get("type", {}).get("state", "pre")
        game_status = parse_espn_status(status_type)

        home_team = home.get("team", {})
        away_team = away.get("team", {})

        result = {
            "game_id": str(header.get("id", event_id)),
            "home_team": home_team.get("displayName", home_team.get("name", "")),
            "home_tricode": home_team.get("abbreviation", ""),
            "away_team": away_team.get("displayName", away_team.get("name", "")),
            "away_tricode": away_team.get("abbreviation", ""),
            "home_score": safe_int(home.get("score", "0")),
            "away_score": safe_int(away.get("score", "0")),
            "status": game_status,
            "period": parse_period(status),
            "clock": parse_clock(status),
            "start_time": header.get("gameDate", ""),
        }

        ttl = FINAL_CACHE_TTL_SECONDS if game_status == "final" else CACHE_TTL_SECONDS
        set_cached(cache_key, result, ttl)
        return result
    except Exception as e:
        logger.error(f"Failed to fetch soccer fixture {event_id}: {e}")
        return None
