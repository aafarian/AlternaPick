"""
MLB (Major League Baseball) data client.

Primary boxscore source: MLB Stats API (statsapi.mlb.com) — provides per-player
totalBases, doubles, triples, and 30+ other fields.  Free, no key required.

Fallback + scoreboard source: ESPN public API — used for live game status,
scores, and as a boxscore fallback if the MLB API is unavailable.
"""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from utils.espn_helpers import (
    EspnRateLimiter,
    get_cached,
    set_cached,
    get_http_client,
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
MLB_API_BASE = "https://statsapi.mlb.com/api/v1"

_rate_limiter = EspnRateLimiter(min_interval=0.3)


async def _espn_get(endpoint: str, params: dict | None = None) -> dict:
    """Make a rate-limited GET request to ESPN with retry."""
    return await espn_get_with_retry(
        _rate_limiter,
        f"{ESPN_BASE}{endpoint}",
        params,
    )


# ---------------------------------------------------------------------------
# MLB Stats API helpers
# ---------------------------------------------------------------------------

async def _mlb_api_get(path: str, params: dict | None = None) -> dict:
    """GET request to the MLB Stats API with retry."""
    client = get_http_client()
    url = f"{MLB_API_BASE}{path}"
    for attempt in range(2):
        try:
            resp = await client.get(url, params=params, timeout=10.0)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            if attempt == 0:
                await asyncio.sleep(0.5)
            else:
                raise


async def _resolve_game_pk(espn_event_id: str) -> int | None:
    """Map an ESPN event ID to an MLB Stats API gamePk.

    Fetches the MLB schedule for the game's date and matches by team names
    against the ESPN scoreboard.  Result is cached for 6 hours.
    """
    cache_key = f"mlb_gamepk:{espn_event_id}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached  # may be None (negative cache)

    # We need the game date and teams.  Fetch from ESPN scoreboard cache
    # (already warm from the background refresh loop) or the summary header.
    try:
        summary = await _espn_get("/summary", {"event": espn_event_id})
        header = summary.get("header", {})
        competitions = header.get("competitions", [{}])
        comp = competitions[0] if competitions else {}
        game_date_str = comp.get("date", "")
        competitors = comp.get("competitors", [])
        espn_teams: set[str] = set()
        for c in competitors:
            team = c.get("team", {})
            name = team.get("displayName", team.get("name", ""))
            if name:
                espn_teams.add(name.lower())
    except Exception as e:
        logger.warning(f"Failed to get ESPN summary for gamePk mapping: {e}")
        return None

    if not game_date_str or len(espn_teams) < 2:
        return None

    # Parse date for MLB API schedule query (YYYY-MM-DD)
    try:
        dt = datetime.fromisoformat(game_date_str.replace("Z", "+00:00"))
        # MLB schedule uses ET dates — games after midnight UTC are same-day ET
        schedule_date = dt.astimezone(_ET).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None

    try:
        schedule = await _mlb_api_get("/schedule", {
            "date": schedule_date,
            "sportId": "1",
        })
    except Exception as e:
        logger.warning(f"MLB API schedule fetch failed: {e}")
        return None

    # Match by team names
    for date_entry in schedule.get("dates", []):
        for game in date_entry.get("games", []):
            teams = game.get("teams", {})
            away_name = teams.get("away", {}).get("team", {}).get("name", "").lower()
            home_name = teams.get("home", {}).get("team", {}).get("name", "").lower()
            # ESPN uses "Kansas City Royals", MLB API uses "Kansas City Royals" — should match
            if away_name in espn_teams or home_name in espn_teams:
                # Verify BOTH teams match to avoid false positives
                if away_name in espn_teams and home_name in espn_teams:
                    game_pk = game.get("gamePk")
                    set_cached(cache_key, game_pk, 6 * 3600)
                    return game_pk

    # No match found — cache None to avoid repeated lookups
    set_cached(cache_key, None, 600)  # retry in 10 minutes
    return None


def _build_player_dict(
    player_name: str,
    player_id: str,
    team_name: str,
    team_tricode: str,
    role: str,
    batting: dict | None = None,
    pitching: dict | None = None,
) -> dict:
    """Build a player dict in the standard boxscore format."""
    if role == "batter" and batting:
        h = batting.get("hits", 0)
        hr = batting.get("homeRuns", 0)
        doubles = batting.get("doubles", 0)
        triples = batting.get("triples", 0)
        r = batting.get("runs", 0)
        rbi = batting.get("rbi", 0)
        return {
            "player_name": player_name,
            "player_id": player_id,
            "team": team_name,
            "team_tricode": team_tricode,
            "role": "batter",
            "hits": h,
            "at_bats": batting.get("atBats", 0),
            "runs": r,
            "home_runs": hr,
            "rbis": rbi,
            "stolen_bases": batting.get("stolenBases", 0),
            "walks": batting.get("baseOnBalls", 0),
            "strikeouts": batting.get("strikeOuts", 0),
            "total_bases": batting.get("totalBases", h + doubles + 2 * triples + 3 * hr),
            "hits_runs_rbis": h + r + rbi,
            "points": 0, "rebounds": 0, "assists": 0, "steals": 0,
            "blocks": 0, "turnovers": 0, "threes_made": 0, "minutes": "0",
        }

    if role == "pitcher" and pitching:
        ip_str = str(pitching.get("inningsPitched", "0"))
        try:
            ip_float = float(ip_str)
            whole = int(ip_float)
            frac = round((ip_float - whole) * 10)
            outs = whole * 3 + frac
        except (ValueError, TypeError):
            outs = 0
        return {
            "player_name": player_name,
            "player_id": player_id,
            "team": team_name,
            "team_tricode": team_tricode,
            "role": "pitcher",
            "pitcher_strikeouts": pitching.get("strikeOuts", 0),
            "pitcher_outs": outs,
            "hits": 0, "runs": 0, "home_runs": 0, "rbis": 0,
            "stolen_bases": 0, "total_bases": 0, "hits_runs_rbis": 0,
            "points": 0, "rebounds": 0, "assists": 0, "steals": 0,
            "blocks": 0, "turnovers": 0, "threes_made": 0, "minutes": "0",
        }

    return {}


async def _get_mlb_api_boxscore(game_pk: int) -> list[dict]:
    """Fetch per-player boxscore from the MLB Stats API.

    Returns the same flat player list format as the ESPN boxscore.
    """
    data = await _mlb_api_get(f"/game/{game_pk}/boxscore")
    players = []

    for side in ("away", "home"):
        team_data = data.get("teams", {}).get(side, {})
        team_info = team_data.get("team", {})
        team_name = team_info.get("name", "")
        # MLB API doesn't have a tricode in the boxscore — extract from abbreviation
        team_tricode = team_info.get("abbreviation", "")

        for pid, player_obj in team_data.get("players", {}).items():
            person = player_obj.get("person", {})
            p_name = person.get("fullName", "")
            p_id = str(person.get("id", ""))
            stats = player_obj.get("stats", {})
            batting = stats.get("batting", {})
            pitching = stats.get("pitching", {})
            position = player_obj.get("position", {}).get("code", "")

            # A player can appear as both batter and pitcher (two-way players).
            # Emit a batter entry if they have at-bats, pitcher if innings pitched.
            if batting and batting.get("atBats", 0) > 0:
                entry = _build_player_dict(p_name, p_id, team_name, team_tricode, "batter", batting=batting)
                if entry:
                    players.append(entry)

            if pitching and pitching.get("inningsPitched", "0") != "0":
                entry = _build_player_dict(p_name, p_id, team_name, team_tricode, "pitcher", pitching=pitching)
                if entry:
                    players.append(entry)

    return players


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
                # For MLB, use shortDetail (e.g. "Bot 8th", "Top 3rd") instead of
                # the display clock (always "0:00" in baseball — no game clock).
                "clock": status.get("type", {}).get("shortDetail", "") or parse_clock(status),
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
    """Fetch player boxscore — MLB Stats API primary, ESPN fallback.

    The MLB Stats API provides per-player totalBases, doubles, and triples
    directly.  ESPN's boxscore labels omit these fields, requiring fragile
    parsing of display strings.  We try the MLB API first and only fall back
    to ESPN when the gamePk lookup or API call fails.
    """
    cache_key = f"mlb_boxscore:{event_id}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    # --- Primary source: MLB Stats API ---
    try:
        game_pk = await _resolve_game_pk(event_id)
        if game_pk is not None:
            players = await _get_mlb_api_boxscore(game_pk)
            if players:
                # Determine cache TTL from the game status
                try:
                    game_data = await _mlb_api_get(f"/game/{game_pk}/feed/live")
                    state = game_data.get("gameData", {}).get("status", {}).get("abstractGameState", "")
                    is_final = state == "Final"
                except Exception:
                    is_final = False
                ttl = FINAL_CACHE_TTL_SECONDS if is_final else CACHE_TTL_SECONDS
                set_cached(cache_key, players, ttl)
                logger.info(f"MLB API boxscore for event {event_id} (gamePk={game_pk}): {len(players)} players")
                return players
    except Exception as e:
        logger.warning(f"MLB API boxscore failed for event {event_id}, falling back to ESPN: {e}")

    # --- Fallback: ESPN ---
    try:
        data = await _espn_get("/summary", {"event": event_id})

        players = []
        boxscore = data.get("boxscore", {})

        # Parse doubles and triples from battingDetails so we can compute
        # per-player total bases.  ESPN's boxscore labels don't include TB,
        # 2B, or 3B — they only appear in the team-level details section as
        # display strings like "Smith (5, Sewald); Ward (1, Nelson)".
        # Each semicolon-separated entry is one extra-base hit.
        extra_base_hits: dict[str, dict[str, int]] = {}  # team_name -> {player_last_name: count}
        for team_data in boxscore.get("teams", []):
            team_name = team_data.get("team", {}).get("displayName", "")
            doubles: dict[str, int] = {}
            triples: dict[str, int] = {}
            for detail_group in team_data.get("details", []):
                for stat in detail_group.get("stats", []):
                    name = stat.get("name", "")
                    display = stat.get("displayValue", "")
                    if not display:
                        continue
                    target = None
                    if name == "doubles":
                        target = doubles
                    elif name == "triples":
                        target = triples
                    if target is not None:
                        # Parse "LastName (N, ...); LastName2 (N, ...)"
                        for entry in display.split(";"):
                            entry = entry.strip()
                            paren = entry.find("(")
                            if paren > 0:
                                last_name = entry[:paren].strip().lower()
                                target[last_name] = target.get(last_name, 0) + 1
            extra_base_hits[team_name] = {"doubles": doubles, "triples": triples}

        for team_data in boxscore.get("players", []):
            team_info = team_data.get("team", {})
            team_name = team_info.get("displayName", team_info.get("name", ""))
            team_tricode = team_info.get("abbreviation", "")

            # ESPN baseball boxscores have stat groups: batting (index 0), pitching (index 1).
            # The "name" field is often empty, so detect by labels or index.
            for group_idx, stat_group in enumerate(team_data.get("statistics", [])):
                labels = [lbl.lower() for lbl in stat_group.get("labels", [])]
                # Detect group type by labels: batting has "ab"/"h", pitching has "ip"/"er"
                is_batting = "ab" in labels or "h-ab" in labels
                is_pitching = "ip" in labels or "er" in labels
                # Fallback to index: first group = batting, second = pitching
                if not is_batting and not is_pitching:
                    is_batting = group_idx == 0
                    is_pitching = group_idx == 1
                group_name = "batting" if is_batting else "pitching" if is_pitching else ""

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
                        h = safe_int(stat_map.get("h", "0"))
                        hr = safe_int(stat_map.get("hr", "0"))
                        # Compute total bases: TB = H + 2B + 2×3B + 3×HR
                        # Look up doubles/triples from battingDetails by last name
                        team_xbh = extra_base_hits.get(team_name, {})
                        last_name = player_name.rsplit(" ", 1)[-1].lower() if player_name else ""
                        player_2b = team_xbh.get("doubles", {}).get(last_name, 0)
                        player_3b = team_xbh.get("triples", {}).get(last_name, 0)
                        tb = h + player_2b + 2 * player_3b + 3 * hr

                        players.append({
                            "player_name": player_name,
                            "player_id": player_id,
                            "team": team_name,
                            "team_tricode": team_tricode,
                            "role": "batter",
                            # Batting stats
                            "hits": h,
                            "at_bats": safe_int(stat_map.get("ab", "0")),
                            "runs": safe_int(stat_map.get("r", "0")),
                            "home_runs": hr,
                            "rbis": safe_int(stat_map.get("rbi", "0")),
                            "stolen_bases": safe_int(stat_map.get("sb", "0")),
                            "walks": safe_int(stat_map.get("bb", "0")),
                            "strikeouts": safe_int(stat_map.get("k", stat_map.get("so", "0"))),
                            "total_bases": tb,
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


async def get_mlb_team_roster(team_id: str) -> list[dict]:
    """Fetch MLB team roster from ESPN. Returns list of {name, id}."""
    cache_key = f"mlb_roster:{team_id}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        data = await _espn_get(f"/teams/{team_id}/roster")
        players = []
        # ESPN MLB rosters nest players under position groups:
        # athletes: [{ position: "Pitchers", items: [{ id, displayName, ... }] }, ...]
        for group in data.get("athletes", []):
            for athlete in group.get("items", []):
                player_id = str(athlete.get("id", ""))
                display_name = athlete.get("displayName", athlete.get("fullName", ""))
                if player_id and display_name:
                    players.append({
                        "name": display_name,
                        "id": player_id,
                    })
        set_cached(cache_key, players, 6 * 3600)  # Cache for 6 hours
        return players
    except Exception as e:
        logger.warning(f"Failed to fetch MLB roster for team {team_id}: {e}")
        return []


async def get_mlb_player_mapping(team_ids: list[str] | None = None) -> dict[str, str]:
    """Get player name → ESPN player ID mapping for MLB teams.

    If team_ids is provided, fetch rosters for those specific teams.
    Otherwise, fetch rosters for all of today's game teams.
    """
    cache_key = f"mlb_player_mapping:{','.join(sorted(team_ids)) if team_ids else 'today'}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    if team_ids is None:
        games = await get_todays_mlb_games()
        team_ids = list(set(
            game.get("home_team_id", "") for game in games
        ) | set(
            game.get("away_team_id", "") for game in games
        ))

    team_ids = [tid for tid in team_ids if tid]

    sem = asyncio.Semaphore(10)

    async def _fetch(tid: str) -> list[dict]:
        async with sem:
            return await get_mlb_team_roster(tid)

    rosters = await asyncio.gather(*[_fetch(tid) for tid in team_ids])
    mapping: dict[str, str] = {}
    for roster in rosters:
        for player in roster:
            mapping[player["name"].lower()] = player["id"]

    set_cached(cache_key, mapping, 3600)
    return mapping
