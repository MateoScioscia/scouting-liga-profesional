"""
Scrapea los match logs (partido a partido) de FBref para jugadores del
plantel de la Liga Profesional Argentina y los carga en `player_match_stats`
via la RPC `admin_import_player_match_stats`.

Requiere que el jugador tenga `fbref_id` guardado en `players` -- lo completa
`sync_fbref.py` a partir del link de cada jugador en la tabla de estadisticas
de temporada. Si un jugador nunca aparecio en esa tabla (lesionado toda la
temporada, recien llegado, etc.) no se puede ubicar su pagina de match logs
y este script lo salta.

A diferencia del scrape de estadisticas de temporada (una sola tabla para
toda la liga), esto es UN PEDIDO POR JUGADOR -- con ~300+ jugadores en el
plantel completo, conviene probar primero con pocos (`PLAYER_FILTER` /
`MAX_PLAYERS`) antes de correr el lote completo, porque FBref ya rate-limita
agresivo con mucho menos volumen (ver sync_fbref.py).

No sabemos de antemano el formato exacto de temporada que usa FBref para
esta competencia en las paginas de match logs (a diferencia de la tabla de
liga, que no lleva temporada en la URL) -- este script prueba el año simple
("2025") y el rango partido ("2024-2025") y usa el que responda.

    pip install -r scripts/requirements.txt
    playwright install --with-deps chromium
    SUPABASE_URL=... SUPABASE_ANON_KEY=... ADMIN_PASSCODE=... SEASON=2025 \
        python scripts/fetch_fbref_matchlogs.py
"""

from __future__ import annotations

import os
import sys
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup, Comment
from playwright.sync_api import sync_playwright

PLAYER_FILTER = os.environ.get("PLAYER_FILTER", "").strip()
MAX_PLAYERS = int(os.environ.get("MAX_PLAYERS", "0") or "0") or None
SEASON = os.environ.get("SEASON", "2025").strip()

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
CHALLENGE_MARKERS = ("just a moment", "attention required", "cf-browser-verification")

# data-stat de FBref -> nuestra columna. Varios campos tienen mas de un
# nombre candidato porque el sitio no siempre usa el mismo data-stat entre
# distintas vistas/versiones.
FIELD_CANDIDATES: dict[str, tuple[str, ...]] = {
    "match_date": ("date",),
    "competition": ("comp",),
    "round": ("round",),
    "venue": ("venue",),
    "opponent": ("opponent",),
    "result_code": ("result",),
    "started": ("game_started", "started"),
    "position_specific": ("position",),
    "minutes_played": ("minutes",),
    "goals": ("goals",),
    "assists": ("assists",),
    "penalty_goals": ("pens_made",),
    "penalty_attempts": ("pens_att",),
    "shots": ("shots", "shots_total"),
    "shots_on_target": ("shots_on_target",),
    "yellow_cards": ("cards_yellow",),
    "red_cards": ("cards_red",),
    "touches": ("touches",),
    "tackles": ("tackles",),
    "interceptions": ("interceptions",),
    "blocks": ("blocks",),
    "xg": ("xg",),
    "npxg": ("npxg",),
    "xag": ("xg_assist", "xag"),
    "sca": ("sca",),
    "gca": ("gca",),
    "passes_completed": ("passes_completed",),
    "passes_attempted": ("passes", "passes_total"),
    "progressive_passes": ("progressive_passes",),
    "carries": ("carries",),
    "progressive_carries": ("progressive_carries",),
    "take_ons_attempted": ("take_ons",),
    "take_ons_successful": ("take_ons_won",),
}
TEXT_FIELDS = {"match_date", "competition", "round", "venue", "opponent", "result_code", "position_specific"}


def to_num(value, default=0):
    if value is None:
        return default
    s = str(value).strip().replace(",", "")
    if s in ("", "-", "—"):
        return default
    try:
        return int(s)
    except ValueError:
        try:
            return float(s)
        except ValueError:
            return default


def load_page(page, url: str, retries: int = 3) -> tuple[str | None, int | None]:
    status = None
    for attempt in range(retries):
        resp = page.goto(url, wait_until="domcontentloaded", timeout=45000, referer="https://fbref.com/")
        status = resp.status if resp else None
        if status == 404:
            return None, status
        if status == 200:
            page.wait_for_timeout(1500)
            html_text = page.content()
            lowered = html_text.lower()
            if "matchlogs_" in html_text or not any(m in lowered for m in CHALLENGE_MARKERS):
                return html_text, status
            print("    parece un desafio de Cloudflare, reintentando...", file=sys.stderr)
        else:
            print(f"    status {status} recibido", file=sys.stderr)
        if attempt < retries - 1:
            wait_ms = 15000 * (attempt + 1)
            page.wait_for_timeout(wait_ms)
    return None, status


def find_matchlog_table(html_text: str):
    soup = BeautifulSoup(html_text, "lxml")
    candidates = [t for t in soup.find_all("table") if (t.get("id") or "").startswith("matchlogs_")]
    if not candidates:
        for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
            if "matchlogs_" in comment:
                inner = BeautifulSoup(str(comment), "lxml")
                candidates.extend(t for t in inner.find_all("table") if (t.get("id") or "").startswith("matchlogs_"))
    if not candidates:
        return None
    for table in candidates:
        if table.get("id") in ("matchlogs_for", "matchlogs_all"):
            return table
    return candidates[0]


def parse_matchlog_table(table) -> list[dict]:
    tbody = table.find("tbody")
    if tbody is None:
        return []
    rows = []
    for tr in tbody.find_all("tr"):
        classes = tr.get("class") or []
        if "thead" in classes or "spacer" in classes:
            continue
        cells = {}
        for cell in tr.find_all(["th", "td"]):
            stat = cell.get("data-stat")
            if stat:
                cells[stat] = cell.get_text(strip=True)
        if cells.get("date"):
            rows.append(cells)
    return rows


def map_row(raw: dict) -> dict | None:
    out: dict = {}
    for field, candidates in FIELD_CANDIDATES.items():
        value = next((raw[c] for c in candidates if raw.get(c)), None)
        if field in TEXT_FIELDS:
            out[field] = (value or "").strip() or None
        elif field == "started":
            out[field] = (str(value).strip().upper() == "Y") if value is not None else None
        else:
            out[field] = to_num(value, 0)
    if not out.get("match_date"):
        return None
    return out


def season_url_candidates(fbref_id: str, season: str) -> list[str]:
    formats = [season]
    if season.isdigit():
        formats.append(f"{int(season) - 1}-{season}")
    seen = set()
    urls = []
    for fmt in formats:
        if fmt in seen:
            continue
        seen.add(fmt)
        urls.append(f"https://fbref.com/en/players/{fbref_id}/matchlogs/{fmt}/summary/")
    return urls


def fetch_player_matchlogs(page, fbref_id: str, season: str, debug: bool = False) -> list[dict]:
    for url in season_url_candidates(fbref_id, season):
        html_text, status = load_page(page, url)
        if html_text is None:
            if debug:
                print(f"    {url} -> status {status}, sin tabla")
            continue
        table = find_matchlog_table(html_text)
        if table is None:
            if debug:
                title = BeautifulSoup(html_text, "lxml").title
                print(f"    {url} -> 200 pero sin tabla matchlogs_*. title={title.get_text(strip=True) if title else None!r}")
            continue
        raw_rows = parse_matchlog_table(table)
        if debug and raw_rows:
            print(f"    columnas detectadas en primera fila: {sorted(raw_rows[0].keys())}")
        mapped = [m for m in (map_row(r) for r in raw_rows) if m]
        if mapped:
            return mapped
    return []


def fetch_roster(supabase_url: str, headers: dict) -> list[dict]:
    filters = ["team_id=not.is.null", "fbref_id=not.is.null", "select=id,full_name,fbref_id"]
    if PLAYER_FILTER:
        filters.append(f"full_name=ilike.*{quote(PLAYER_FILTER)}*")
    else:
        filters.append("order=full_name.asc")
    resp = requests.get(f"{supabase_url}/rest/v1/players?{'&'.join(filters)}", headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def push_matchlogs(supabase_url: str, headers: dict, passcode: str, player_id: str, rows: list[dict]) -> int:
    endpoint = f"{supabase_url}/rest/v1/rpc/admin_import_player_match_stats"
    resp = requests.post(
        endpoint, headers=headers, json={"passcode": passcode, "p_player_id": player_id, "rows": rows}, timeout=60
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"{resp.status_code} {resp.text}")
    return resp.json().get("inserted", len(rows))


def main() -> None:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    passcode = os.environ["ADMIN_PASSCODE"]

    read_headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
    write_headers = {**read_headers, "Content-Type": "application/json"}

    roster = fetch_roster(supabase_url, read_headers)
    if MAX_PLAYERS:
        roster = roster[:MAX_PLAYERS]
    print(f"{len(roster)} jugadores a procesar (temporada {SEASON})" + (f", filtro: {PLAYER_FILTER}" if PLAYER_FILTER else ""))
    if not roster:
        print("Nada para procesar -- revisa que sync_fbref.py haya corrido y completado fbref_id en players.")
        return

    debug = bool(PLAYER_FILTER)
    ok = empty = failed = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=USER_AGENT,
            locale="en-US",
            viewport={"width": 1366, "height": 768},
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9,es-AR;q=0.8,es;q=0.7"},
        )
        page = context.new_page()

        for i, player in enumerate(roster, start=1):
            print(f"[{i}/{len(roster)}] {player['full_name']} (fbref_id={player['fbref_id']})")
            try:
                rows = fetch_player_matchlogs(page, player["fbref_id"], SEASON, debug=debug)
            except Exception as exc:  # noqa: BLE001 - seguimos con el resto si uno falla
                print(f"  ERROR scrapeando: {exc}", file=sys.stderr)
                failed += 1
                page.wait_for_timeout(5000)
                continue

            if not rows:
                print("  sin partidos encontrados para esta temporada")
                empty += 1
                page.wait_for_timeout(3000)
                continue

            try:
                inserted = push_matchlogs(supabase_url, write_headers, passcode, player["id"], rows)
                print(f"  {inserted} partidos cargados")
                ok += 1
            except Exception as exc:
                print(f"  ERROR guardando en Supabase: {exc}", file=sys.stderr)
                failed += 1

            page.wait_for_timeout(4000)  # FBref rate-limita agresivo

        browser.close()

    print(f"Listo: {ok} jugadores con datos cargados, {empty} sin partidos, {failed} con error.")


if __name__ == "__main__":
    main()
