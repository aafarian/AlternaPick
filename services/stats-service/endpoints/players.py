import time
from fastapi import APIRouter

router = APIRouter(prefix="/players", tags=["players"])

# In-memory cache for enriched player data (refreshes every 24h)
_player_cache: dict = {"data": None, "ts": 0}
_CACHE_TTL = 86400  # 24 hours


def _get_enriched_players() -> list[dict]:
    now = time.time()
    if _player_cache["data"] and now - _player_cache["ts"] < _CACHE_TTL:
        return _player_cache["data"]

    from nba_api.stats.static import players as static_players

    # Static list for name → id mapping (fast, no network call)
    static_list = {
        str(p["id"]): p
        for p in static_players.get_players()
        if p.get("is_active", False)
    }

    # Try to get team data from CommonAllPlayers (network call, may fail)
    team_map: dict[str, dict] = {}
    try:
        from nba_api.stats.endpoints import commonallplayers

        cap = commonallplayers.CommonAllPlayers(
            is_only_current_season=1, timeout=10
        )
        rows = cap.get_normalized_dict()["CommonAllPlayers"]
        for row in rows:
            pid = str(row.get("PERSON_ID", ""))
            team_abbr = row.get("TEAM_ABBREVIATION", "")
            if pid and team_abbr:
                team_map[pid] = {"team_abbreviation": team_abbr}
    except Exception:
        pass  # Fall back to no team data

    # Try to get position data from PlayerIndex (network call, may fail)
    position_map: dict[str, str] = {}
    try:
        from nba_api.stats.endpoints import playerindex

        pi = playerindex.PlayerIndex(timeout=10)
        rows = pi.get_normalized_dict()["PlayerIndex"]
        for row in rows:
            pid = str(row.get("PERSON_ID", ""))
            pos = row.get("POSITION", "")
            if pid and pos:
                position_map[pid] = pos
    except Exception:
        pass  # Fall back to no position data

    result = []
    for pid, p in static_list.items():
        entry = {
            "id": pid,
            "full_name": p["full_name"],
            "first_name": p["first_name"],
            "last_name": p["last_name"],
        }
        if pid in team_map:
            entry["team_abbreviation"] = team_map[pid]["team_abbreviation"]
        if pid in position_map:
            entry["position"] = position_map[pid]
        result.append(entry)

    _player_cache["data"] = result
    _player_cache["ts"] = now
    return result


@router.get("/all")
async def all_players():
    """Return all active NBA players with IDs and team data."""
    data = _get_enriched_players()
    return {"data": data, "count": len(data)}
