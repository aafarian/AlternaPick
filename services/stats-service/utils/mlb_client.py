"""
ESPN client for fetching MLB (Major League Baseball) data.

Uses ESPN's free public API (no key required):
  - Scoreboard: site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard
  - Summary:    site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary
"""

import asyncio
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

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb"

_rate_limiter = EspnRateLimiter(min_interval=0.3)


async def _espn_get(endpoint: str, params: dict | None = None) -> dict:
    """Make a rate-limited GET request to ESPN with retry."""
    return await espn_get_with_retry(
        _rate_limiter,
        f"{ESPN_BASE}{endpoint}",
        params,
    )


async def get_todays_mlb_games(target_date: str | None = None) -> list[dict]:
    """Fetch MLB games with scores and status from ESPN.

    Args:
        target_date: Date in YYYYMMDD format. Defaults to today.
    """
    today = target_date or datetime.now(_ET).strftime("%Y%m%d")
    cache_key = f"mlb_games:{today}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _espn_get("/scoreboard", {
            "dates": today,
            "limit": "50",
        })

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
                "home_team_id": str(home_team_data.get("id", "")),
                "away_team_id": str(away_team_data.get("id", "")),
            })

        set_cached(cache_key, games)
        return games
    except Exception as e:
        logger.error(f"Failed to fetch MLB games: {e}")
        raise


async def get_todays_mlb_games_cached() -> list[dict]:
    """Get today's MLB games from cache (30s TTL) or fetch fresh."""
    return await get_todays_mlb_games()


async def get_mlb_boxscore(event_id: str) -> list[dict]:
    """Fetch player boxscore for an MLB game from ESPN summary.

    Baseball boxscores have separate sections for batting and pitching.
    We combine both into a flat player list with all available stats.
    """
    cache_key = f"mlb_boxscore:{event_id}"
    cached = get_cached(cache_key)
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

            # ESPN baseball boxscores have multiple stat groups: batting, pitching, fielding
            for stat_group in team_data.get("statistics", []):
                group_name = stat_group.get("name", "").lower()
                labels = [lbl.lower() for lbl in stat_group.get("labels", [])]

                for athlete in stat_group.get("athletes", []):
                    athlete_info = athlete.get("athlete", {})
                    stats_values = athlete.get("stats", [])
                    player_name = athlete_info.get("displayName", "")
                    player_id = str(athlete_info.get("id", ""))

                    if not stats_values:
                        continue

                    # Build a label→value map
                    stat_map = {}
                    for i, label in enumerate(labels):
                        if i < len(stats_values):
                            stat_map[label] = stats_values[i]

                    if group_name == "batting":
                        players.append({
                            "player_name": player_name,
                            "player_id": player_id,
                            "team": team_name,
                            "team_tricode": team_tricode,
                            "role": "batter",
                            # Batting stats
                            "hits": safe_int(stat_map.get("h", "0")),
                            "at_bats": safe_int(stat_map.get("ab", "0")),
                            "runs": safe_int(stat_map.get("r", "0")),
                            "home_runs": safe_int(stat_map.get("hr", "0")),
                            "rbis": safe_int(stat_map.get("rbi", "0")),
                            "stolen_bases": safe_int(stat_map.get("sb", "0")),
                            "walks": safe_int(stat_map.get("bb", "0")),
                            "strikeouts": safe_int(stat_map.get("k", stat_map.get("so", "0"))),
                            # Total bases: 1B + 2×2B + 3×3B + 4×HR
                            # ESPN doesn't always provide TB directly, so we may need to compute
                            "total_bases": safe_int(stat_map.get("tb", "0")),
                            # Composite: H+R+RBI
                            "hits_runs_rbis": (
                                safe_int(stat_map.get("h", "0")) +
                                safe_int(stat_map.get("r", "0")) +
                                safe_int(stat_map.get("rbi", "0"))
                            ),
                            # Keep basketball-compatible fields for the resolution engine
                            "points": 0,
                            "rebounds": 0,
                            "assists": 0,
                            "steals": 0,
                            "blocks": 0,
                            "turnovers": 0,
                            "threes_made": 0,
                            "minutes": "0",
                        })

                    elif group_name == "pitching":
                        # Parse innings pitched (e.g., "6.2" = 6 2/3 innings)
                        ip_str = stat_map.get("ip", "0")
                        try:
                            ip_float = float(ip_str)
                            # Convert fractional innings: .1 = 1/3, .2 = 2/3
                            whole = int(ip_float)
                            frac = round((ip_float - whole) * 10)
                            outs = whole * 3 + frac
                        except (ValueError, TypeError):
                            outs = 0

                        players.append({
                            "player_name": player_name,
                            "player_id": player_id,
                            "team": team_name,
                            "team_tricode": team_tricode,
                            "role": "pitcher",
                            # Pitching stats
                            "pitcher_strikeouts": safe_int(stat_map.get("k", stat_map.get("so", "0"))),
                            "pitcher_outs": outs,
                            "hits": 0,
                            "runs": 0,
                            "home_runs": 0,
                            "rbis": 0,
                            "stolen_bases": 0,
                            "total_bases": 0,
                            "hits_runs_rbis": 0,
                            # Basketball-compatible fields
                            "points": 0,
                            "rebounds": 0,
                            "assists": 0,
                            "steals": 0,
                            "blocks": 0,
                            "turnovers": 0,
                            "threes_made": 0,
                            "minutes": "0",
                        })

        # Check if the game is final — use longer cache TTL
        status_data = data.get("header", {}).get("competitions", [{}])[0].get("status", {})
        is_final = status_data.get("type", {}).get("state", "") == "post"
        ttl = FINAL_CACHE_TTL_SECONDS if is_final else CACHE_TTL_SECONDS

        set_cached(cache_key, players, ttl)
        return players
    except Exception as e:
        logger.error(f"Failed to fetch MLB boxscore for event {event_id}: {e}")
        raise


async def get_mlb_boxscore_cached(event_id: str) -> list[dict]:
    """Get cached MLB boxscore (30s TTL for live, 1hr for final)."""
    return await get_mlb_boxscore(event_id)
