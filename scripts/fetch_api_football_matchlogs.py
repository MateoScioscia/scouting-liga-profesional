"""
Carga estadisticas partido a partido para el plantel de la Liga Profesional
Argentina desde API-Football (https://www.api-football.com/), como
alternativa a FBref -- que bloquea de plano (403) los pedidos desde runners
de GitHub Actions (ver scripts/fetch_fbref_matchlogs.py).

A diferencia de FBref (un pedido por jugador), aca UN PEDIDO POR PARTIDO
devuelve las estadisticas de TODOS los jugadores que jugaron ese partido --
mucho mas eficiente. El plan free tiene 100 pedidos/dia, mas que suficiente
para probar con unos pocos partidos antes de decidir si pagar el plan Pro
($19/mes, 7500 pedidos/dia) para cargar una temporada completa.

Necesita la API key como secret de GitHub (API_FOOTBALL_KEY) o variable de
entorno local -- registrate en https://dashboard.api-football.com/register
y pega la key ahi, nunca en el chat ni en el codigo.

Matching equipo/jugador: API-Football usa nombres oficiales completos
("Argentinos Juniors", "Central Cordoba SdE"), pero nuestra tabla `teams`
tiene apodos/abreviaturas de FBref ("Arg Juniors", "C. Cordoba-SdE"). Hay un
diccionario de alias abajo (TEAM_ALIASES) con los 30 equipos: completalo o
corregilo la primera vez que corras esto y mires los nombres reales que
devuelve la API (con DEBUG_MATCHING=1 imprime todo lo que no matcheo). Una
vez resuelto, el team_id/player_id de API-Football queda cacheado en
`teams.api_football_id` / `players.api_football_id` y no se vuelve a
adivinar.

    pip install -r scripts/requirements.txt
    SUPABASE_URL=... SUPABASE_ANON_KEY=... ADMIN_PASSCODE=... \
    API_FOOTBALL_KEY=... LEAGUE_ID=44 SEASON=2026 MAX_FIXTURES=2 \
        python scripts/fetch_api_football_matchlogs.py
"""

from __future__ import annotations

import os
import re
import sys
import time
import unicodedata

import requests

API_BASE = "https://v3.football.api-sports.io"
LEAGUE_ID = int(os.environ.get("LEAGUE_ID", "44"))  # Liga Profesional Argentina
SEASON = os.environ.get("SEASON", "2026")
MAX_FIXTURES = int(os.environ.get("MAX_FIXTURES", "0") or "0") or None
DEBUG_MATCHING = bool(os.environ.get("DEBUG_MATCHING", ""))

# our team name (tal como esta en `teams`) -> palabras clave para matchear
# contra el nombre oficial de API-Football. Completar/corregir con los
# nombres reales la primera corrida (DEBUG_MATCHING=1).
TEAM_ALIASES: dict[str, list[str]] = {
    "Aldosivi": ["aldosivi"],
    "Arg Juniors": ["argentinos", "juniors"],
    "Atlé Tucumán": ["atletico", "tucuman"],
    "Banfield": ["banfield"],
    "Barracas Central": ["barracas"],
    "Belgrano": ["belgrano"],
    "Boca Juniors": ["boca"],
    "C. Córdoba–SdE": ["central", "cordoba"],
    "CA San Lorenzo": ["lorenzo"],
    "Defensa": ["defensa", "justicia"],
    "Dep. Riestra": ["riestra"],
    "Estudiantes–LP": ["estudiantes", "plata"],
    "Estudiantes–RC": ["estudiantes", "cuarto"],
    "Gimnasia–LP": ["gimnasia", "plata"],
    "Gimnasia–M": ["gimnasia", "mendoza"],
    "Huracán": ["huracan"],
    "Ind. Rivadavia": ["rivadavia"],
    "Independiente": ["independiente"],
    "Instituto": ["instituto"],
    "Lanús": ["lanus"],
    "Newell's": ["newell"],
    "Platense": ["platense"],
    "Racing Club": ["racing"],
    "River Plate": ["river"],
    "Rosario Central": ["rosario", "central"],
    "Sarmiento–J": ["sarmiento"],
    "Talleres–C": ["talleres"],
    "Tigre": ["tigre"],
    "Unión": ["union"],
    "Vélez Sarsfield": ["velez"],
}

FIELD_MAP = {
    # nuestra columna -> ruta dentro de statistics[0] de /fixtures/players
    "minutes_played": ("games", "minutes"),
    "position_specific": ("games", "position"),
    "rating": ("games", "rating"),
    "goals": ("goals", "total"),
    "assists": ("goals", "assists"),
    "shots": ("shots", "total"),
    "shots_on_target": ("shots", "on"),
    "passes_attempted": ("passes", "total"),
    "yellow_cards": ("cards", "yellow"),
    "red_cards": ("cards", "red"),
    "tackles": ("tackles", "total"),
    "interceptions": ("tackles", "interceptions"),
    "blocks": ("tackles", "blocks"),
    "take_ons_attempted": ("dribbles", "attempts"),
    "take_ons_successful": ("dribbles", "success"),
    "penalty_goals": ("penalty", "scored"),
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def best_match(target_tokens: list[str], candidates: dict[str, str]) -> str | None:
    """candidates: {candidate_id: normalized_name}. Elige el que tenga mas tokens en comun."""
    best_id, best_score = None, 0
    for cid, name in candidates.items():
        score = sum(1 for t in target_tokens if t in name)
        if score > best_score:
            best_id, best_score = cid, score
    return best_id if best_score > 0 else None


class ApiFootball:
    def __init__(self, key: str):
        self.headers = {"x-apisports-key": key}

    def get(self, path: str, params: dict) -> list[dict]:
        for attempt in range(3):
            resp = requests.get(f"{API_BASE}{path}", headers=self.headers, params=params, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                errors = data.get("errors")
                if errors:
                    raise RuntimeError(f"API-Football error en {path}: {errors}")
                return data.get("response", [])
            if resp.status_code == 429:
                print(f"    429 rate limited, esperando 10s (intento {attempt + 1}/3)...", file=sys.stderr)
                time.sleep(10)
                continue
            raise RuntimeError(f"{path} -> {resp.status_code} {resp.text[:300]}")
        raise RuntimeError(f"{path}: agotados los reintentos por rate limit")


def fetch_our_teams(supabase_url: str, headers: dict) -> list[dict]:
    resp = requests.get(f"{supabase_url}/rest/v1/teams?select=id,name,api_football_id", headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_our_players(supabase_url: str, headers: dict, team_id: str) -> list[dict]:
    resp = requests.get(
        f"{supabase_url}/rest/v1/players?select=id,full_name,api_football_id&team_id=eq.{team_id}",
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def resolve_team_af_ids(af: ApiFootball, our_teams: list[dict]) -> dict[str, int]:
    """our team_id (uuid) -> api_football team id. Usa cache existente + matching por alias."""
    af_teams = af.get("/teams", {"league": LEAGUE_ID, "season": SEASON})
    af_by_id = {str(t["team"]["id"]): normalize(t["team"]["name"]) for t in af_teams}

    resolved: dict[str, int] = {}
    for team in our_teams:
        if team.get("api_football_id"):
            resolved[team["id"]] = team["api_football_id"]
            continue
        tokens = TEAM_ALIASES.get(team["name"], normalize(team["name"]).split())
        match_af_id = best_match(tokens, af_by_id)
        if match_af_id:
            resolved[team["id"]] = int(match_af_id)
        elif DEBUG_MATCHING:
            print(f"  [sin match] equipo {team['name']!r} (tokens={tokens})", file=sys.stderr)

    if DEBUG_MATCHING:
        print("  nombres reales de API-Football para esta liga/temporada:", file=sys.stderr)
        for t in af_teams:
            print(f"    {t['team']['id']}: {t['team']['name']!r}", file=sys.stderr)

    return resolved


def match_player(full_name: str, our_players_by_norm: dict[str, dict]) -> dict | None:
    norm = normalize(full_name)
    if norm in our_players_by_norm:
        return our_players_by_norm[norm]
    tokens = norm.split()
    best, best_score = None, 0
    for other_norm, player in our_players_by_norm.items():
        score = sum(1 for t in tokens if t in other_norm)
        if score > best_score:
            best, best_score = player, score
    return best if best_score >= 2 else None  # al menos nombre + apellido coinciden


def dig(stats: dict, path: tuple[str, str]):
    return (stats.get(path[0]) or {}).get(path[1])


def build_row(fixture: dict, team_af_name: str, stats: dict) -> dict:
    row: dict = {
        "match_date": fixture["fixture"]["date"][:10],
        "competition": fixture["league"]["name"],
        "round": fixture["league"]["round"],
        "venue": "H" if fixture["teams"]["home"]["name"] == team_af_name else "A",
        "opponent": fixture["teams"]["away"]["name"] if fixture["teams"]["home"]["name"] == team_af_name else fixture["teams"]["home"]["name"],
        "result_code": None,
        "started": (stats.get("games") or {}).get("substitute") is False,
    }
    for our_key, path in FIELD_MAP.items():
        value = dig(stats, path)
        row[our_key] = value
    row["passes_completed"] = None
    passes = stats.get("passes") or {}
    if passes.get("total") is not None and passes.get("accuracy") is not None:
        try:
            row["passes_completed"] = round(int(passes["total"]) * float(str(passes["accuracy"]).replace("%", "")) / 100)
        except (ValueError, TypeError):
            pass

    penalty = stats.get("penalty") or {}
    scored, missed = penalty.get("scored"), penalty.get("missed")
    if scored is not None or missed is not None:
        row["penalty_attempts"] = (scored or 0) + (missed or 0)

    return row


def push_matchlogs(supabase_url: str, headers: dict, passcode: str, player_id: str, rows: list[dict]) -> int:
    endpoint = f"{supabase_url}/rest/v1/rpc/admin_import_player_match_stats"
    resp = requests.post(
        endpoint, headers=headers, json={"passcode": passcode, "p_player_id": player_id, "rows": rows}, timeout=60
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"{resp.status_code} {resp.text}")
    return resp.json().get("inserted", len(rows))


def cache_ids(supabase_url: str, headers: dict, passcode: str, team_id: str | None, team_af_id: int | None, player_id: str | None, player_af_id: int | None) -> None:
    endpoint = f"{supabase_url}/rest/v1/rpc/admin_set_api_football_ids"
    payload = {"passcode": passcode}
    if team_id:
        payload.update({"p_team_id": team_id, "p_team_af_id": team_af_id})
    if player_id:
        payload.update({"p_player_id": player_id, "p_player_af_id": player_af_id})
    resp = requests.post(endpoint, headers=headers, json=payload, timeout=30)
    if resp.status_code >= 300:
        print(f"  aviso: no se pudo cachear id ({resp.status_code} {resp.text})", file=sys.stderr)


def main() -> None:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    passcode = os.environ["ADMIN_PASSCODE"]
    api_key = os.environ["API_FOOTBALL_KEY"]

    read_headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
    write_headers = {**read_headers, "Content-Type": "application/json"}
    af = ApiFootball(api_key)

    our_teams = fetch_our_teams(supabase_url, read_headers)
    team_af_ids = resolve_team_af_ids(af, our_teams)
    print(f"{len(team_af_ids)}/{len(our_teams)} equipos matcheados con API-Football")
    if not team_af_ids:
        print("Ningun equipo matcheo -- revisa TEAM_ALIASES con DEBUG_MATCHING=1 antes de seguir.")
        return

    for team in our_teams:
        af_id = team_af_ids.get(team["id"])
        if af_id and af_id != team.get("api_football_id"):
            cache_ids(supabase_url, write_headers, passcode, team["id"], af_id, None, None)

    af_id_to_team_id = {af_id: team_id for team_id, af_id in team_af_ids.items()}

    fixtures = af.get("/fixtures", {"league": LEAGUE_ID, "season": SEASON, "status": "FT"})
    fixtures.sort(key=lambda f: f["fixture"]["date"])
    if MAX_FIXTURES:
        fixtures = fixtures[-MAX_FIXTURES:]  # los mas recientes primero al probar
    print(f"{len(fixtures)} partidos finalizados a procesar (liga {LEAGUE_ID}, temporada {SEASON})")

    ok = skipped = failed = 0
    for i, fixture in enumerate(fixtures, start=1):
        fixture_id = fixture["fixture"]["id"]
        home, away = fixture["teams"]["home"]["name"], fixture["teams"]["away"]["name"]
        print(f"[{i}/{len(fixtures)}] fixture {fixture_id}: {home} vs {away} ({fixture['fixture']['date'][:10]})")
        try:
            players_by_team = af.get("/fixtures/players", {"fixture": fixture_id})
        except Exception as exc:
            print(f"  ERROR bajando stats: {exc}", file=sys.stderr)
            failed += 1
            continue

        for team_block in players_by_team:
            team_af_id = team_block["team"]["id"]
            our_team_id = af_id_to_team_id.get(team_af_id)
            if not our_team_id:
                continue  # equipo visitante/local que no es de nuestra liga rastreada, o sin matchear

            our_players = fetch_our_players(supabase_url, read_headers, our_team_id)
            by_af_id = {p["api_football_id"]: p for p in our_players if p.get("api_football_id")}
            by_norm = {normalize(p["full_name"]): p for p in our_players}

            for entry in team_block["players"]:
                af_player_id = entry["player"]["id"]
                player = by_af_id.get(af_player_id) or match_player(entry["player"]["name"], by_norm)
                if not player:
                    if DEBUG_MATCHING:
                        print(f"    [sin match] jugador {entry['player']['name']!r} ({team_block['team']['name']})", file=sys.stderr)
                    skipped += 1
                    continue
                if player.get("api_football_id") != af_player_id:
                    cache_ids(supabase_url, write_headers, passcode, None, None, player["id"], af_player_id)

                stats = (entry.get("statistics") or [{}])[0]
                minutes = dig(stats, ("games", "minutes"))
                if minutes is None:
                    continue  # convocado pero no jugo
                row = build_row(fixture, team_block["team"]["name"], stats)
                try:
                    push_matchlogs(supabase_url, write_headers, passcode, player["id"], [row])
                    ok += 1
                except Exception as exc:
                    print(f"    ERROR guardando {entry['player']['name']}: {exc}", file=sys.stderr)
                    failed += 1

        time.sleep(1)  # margen prudente entre partidos

    print(f"Listo: {ok} filas jugador-partido cargadas, {skipped} jugadores sin matchear, {failed} errores.")


if __name__ == "__main__":
    main()
