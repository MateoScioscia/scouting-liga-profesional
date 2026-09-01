"""
Sincroniza estadisticas de jugadores de la Liga Profesional Argentina desde
FBref hacia Supabase, via la funcion RPC `admin_import_players`.

Pensado para correr en GitHub Actions (cron semanal + disparo manual), pero
tambien se puede correr en local:

    pip install -r scripts/requirements.txt
    SUPABASE_URL=... SUPABASE_ANON_KEY=... ADMIN_PASSCODE=... SEASON=2026 \
        python scripts/sync_fbref.py

FBref sirve estadisticas en tablas HTML con atributos `data-stat` estables,
pero su Cloudflare bloquea pedidos HTTP simples (con requests) aunque tengan
headers de navegador real -- devuelve 403 directo, probablemente por
reputacion de IP de datacenter. Por eso esto usa Playwright con Chromium de
verdad (misma idea que usa el paquete LanusStats con pydoll/undetected-
chromedriver), que al menos resuelve el desafio JS/TLS de Cloudflare.
"""

from __future__ import annotations

import os
import sys

import requests
from bs4 import BeautifulSoup, Comment
from playwright.sync_api import sync_playwright

COMP_ID = 21  # Primera Division (Liga Profesional Argentina) en FBref
COMP_SLUG = "Primera-Division-Stats"
BASE = f"https://fbref.com/en/comps/{COMP_ID}"

# (segmento de URL, id de tabla HTML)
TABLES = {
    "standard": ("stats", "stats_standard"),
    "shooting": ("shooting", "stats_shooting"),
    "misc": ("misc", "stats_misc"),
    "defense": ("defense", "stats_defense"),
    "keeper": ("keepers", "stats_keeper"),
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

CHUNK_SIZE = 150

CHALLENGE_MARKERS = ("just a moment", "attention required", "cf-browser-verification")


def load_page(page, url: str, table_id: str, referer: str | None, retries: int = 4) -> str:
    for attempt in range(retries):
        resp = page.goto(url, wait_until="domcontentloaded", timeout=45000, referer=referer)
        status = resp.status if resp else None
        if status == 200:
            page.wait_for_timeout(1500)
            html_text = page.content()
            lowered = html_text.lower()
            if table_id in html_text or not any(m in lowered for m in CHALLENGE_MARKERS):
                return html_text
            print("  parece un desafio de Cloudflare, reintentando...", file=sys.stderr)
        else:
            print(f"  status {status} recibido", file=sys.stderr)
        if attempt < retries - 1:
            wait_ms = 20000 * (attempt + 1)
            print(f"  esperando {wait_ms // 1000}s antes de reintentar...", file=sys.stderr)
            page.wait_for_timeout(wait_ms)
    raise RuntimeError(f"No se pudo cargar {url} tras {retries} intentos (ultimo status: {status})")


def parse_table(html_text: str, table_id: str) -> list[dict]:
    soup = BeautifulSoup(html_text, "lxml")
    table = soup.find("table", {"id": table_id})
    if table is None:
        # FBref suele esconder tablas secundarias dentro de comentarios HTML
        for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
            if table_id in comment:
                inner = BeautifulSoup(str(comment), "lxml")
                table = inner.find("table", {"id": table_id})
                if table is not None:
                    break
    if table is None:
        raise RuntimeError(f"No se encontro la tabla '{table_id}' en la pagina")

    tbody = table.find("tbody")
    rows: list[dict] = []
    for tr in tbody.find_all("tr"):
        classes = tr.get("class") or []
        if "thead" in classes or "spacer" in classes:
            continue  # filas de encabezado repetidas dentro del cuerpo
        cells: dict[str, str] = {}
        for cell in tr.find_all(["th", "td"]):
            stat = cell.get("data-stat")
            if not stat:
                continue
            cells[stat] = cell.get_text(strip=True)
            if stat == "player":
                link = cell.find("a")
                cells["player_href"] = link["href"] if link else ""
        if cells.get("player"):
            rows.append(cells)
    return rows


def to_num(value, default=None):
    if value is None:
        return default
    s = str(value).strip().replace(",", "").replace("%", "")
    if s in ("", "-", "—"):
        return default
    try:
        return float(s) if "." in s else int(s)
    except ValueError:
        try:
            return float(s)
        except ValueError:
            return default


def merge_key(row: dict) -> tuple[str, str]:
    return (row.get("player_href", "") or row.get("player", ""), row.get("team", ""))


def scrape_all() -> list[dict]:
    tables: dict[str, list[dict]] = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=USER_AGENT,
            locale="en-US",
            viewport={"width": 1366, "height": 768},
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9,es-AR;q=0.8,es;q=0.7"},
        )
        page = context.new_page()

        warmup_url = f"{BASE}/{COMP_SLUG}"
        print(f"Calentando sesion: {warmup_url}")
        load_page(page, warmup_url, "stats_standard", referer="https://fbref.com/")
        page.wait_for_timeout(3000)

        referer = warmup_url
        for name, (segment, table_id) in TABLES.items():
            url = f"{BASE}/{segment}/{COMP_SLUG}"
            print(f"Descargando {name}: {url}")
            html_text = load_page(page, url, table_id, referer=referer)
            tables[name] = parse_table(html_text, table_id)
            print(f"  {len(tables[name])} filas")
            referer = url
            page.wait_for_timeout(4000)  # FBref rate-limita agresivo; ser prudentes

        browser.close()

    by_key = {
        name: {merge_key(r): r for r in rows} for name, rows in tables.items()
    }

    players: list[dict] = []
    for base in tables["standard"]:
        key = merge_key(base)
        shooting = by_key["shooting"].get(key, {})
        misc = by_key["misc"].get(key, {})
        defense = by_key["defense"].get(key, {})
        keeper = by_key["keeper"].get(key, {})

        position = base.get("position", "")
        team = base.get("team", "")
        nineties = to_num(base.get("minutes_90s"))

        stats: dict[str, float] = {}

        def put(key_out: str, value):
            if value is not None:
                stats[key_out] = value

        age_raw = str(base.get("age", "")).split("-")[0]
        put("edad", to_num(age_raw))
        put("anio_nacimiento", to_num(base.get("birth_year")))
        put("goles_mas_asist", to_num(base.get("goals_assists")))
        put("goles_sin_penal", to_num(base.get("goals_pens")))
        put("penales_convertidos", to_num(base.get("pens_made")))
        put("penales_intentados", to_num(base.get("pens_att")))
        put(
            "goles_asist_sin_penal_p90",
            to_num(base.get("goals_assists_pens_per90")),
        )

        put("tiros", to_num(shooting.get("shots_total")))
        put("tiros_al_arco", to_num(shooting.get("shots_on_target")))
        put("pct_tiros_al_arco", to_num(shooting.get("shots_on_target_pct")))
        put("tiros_p90", to_num(shooting.get("shots_total_per90")))
        put("tiros_arco_p90", to_num(shooting.get("shots_on_target_per90")))
        put("goles_por_tiro", to_num(shooting.get("goals_per_shot")))
        put("goles_por_tiro_al_arco", to_num(shooting.get("goals_per_shot_on_target")))

        put("doble_amarilla", to_num(misc.get("cards_yellow_red"), 0))
        put("faltas_cometidas", to_num(misc.get("fouls"), 0))
        put("faltas_recibidas", to_num(misc.get("fouled"), 0))
        put("offsides", to_num(misc.get("offsides"), 0))
        put("centros", to_num(misc.get("crosses"), 0))
        put("goles_en_contra", to_num(misc.get("own_goals"), 0))

        interceptions = to_num(defense.get("interceptions"), 0)
        tackles_won = to_num(defense.get("tackles_won"), 0)
        put("intercepciones", interceptions)
        put("entradas_ganadas", tackles_won)

        goals = to_num(base.get("goals"), 0)
        assists = to_num(base.get("assists"), 0)
        fouls = to_num(misc.get("fouls"), 0)
        crosses = to_num(misc.get("crosses"), 0)
        if nineties and nineties > 0:
            put("goles_p90", round(goals / nineties, 3))
            put("asistencias_p90", round(assists / nineties, 3))
            put("intercepciones_p90", round(interceptions / nineties, 3))
            put("entradas_p90", round(tackles_won / nineties, 3))
            put("centros_p90", round(crosses / nineties, 3))
            put("faltas_p90", round(fouls / nineties, 3))

        if keeper:
            put("goles_recibidos", to_num(keeper.get("goals_against")))
            put("goles_recibidos_p90", to_num(keeper.get("goals_against_per90")))
            put("tiros_al_arco_recibidos", to_num(keeper.get("shots_on_target_against")))
            put("atajadas", to_num(keeper.get("saves")))
            put("pct_atajadas", to_num(keeper.get("save_pct")))
            put("partidos_ganados_gk", to_num(keeper.get("wins")))
            put("empatados_gk", to_num(keeper.get("draws")))
            put("perdidos_gk", to_num(keeper.get("losses")))
            put("vallas_invictas", to_num(keeper.get("clean_sheets")))
            put("pct_vallas_invictas", to_num(keeper.get("clean_sheets_pct")))
            put("penales_recibidos_gk", to_num(keeper.get("pens_att_gk")))
            put("penales_atajados", to_num(keeper.get("pens_saved")))
            put("penales_errados_rival", to_num(keeper.get("pens_missed_gk")))

        players.append(
            {
                "full_name": base.get("player", "").strip(),
                "nationality": base.get("nationality", "").strip(),
                "position": position,
                "team": team,
                "matches_played": to_num(base.get("games")),
                "starts": to_num(base.get("games_starts")),
                "minutes_played": to_num(base.get("minutes")),
                "nineties": nineties,
                "goals": goals,
                "assists": assists,
                "yellow_cards": to_num(base.get("cards_yellow"), 0),
                "red_cards": to_num(base.get("cards_red"), 0),
                "position_group": infer_position_group(position),
                "stats": stats,
            }
        )

    return [p for p in players if p["full_name"]]


def infer_position_group(pos: str) -> str:
    p = (pos or "").upper()
    if "GK" in p:
        return "GK"
    if p.startswith("FW") or p.endswith("FW"):
        return "FWD"
    if p.startswith("DF") or p.endswith("DF"):
        return "DEF"
    if "MF" in p:
        return "MID"
    return "MID"


def push_to_supabase(players: list[dict], season: str) -> None:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    passcode = os.environ["ADMIN_PASSCODE"]

    endpoint = f"{supabase_url}/rest/v1/rpc/admin_import_players"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
    }

    total_inserted = 0
    for i in range(0, len(players), CHUNK_SIZE):
        chunk = players[i : i + CHUNK_SIZE]
        payload = {"passcode": passcode, "p_season": season, "rows": chunk}
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=60)
        if resp.status_code >= 300:
            raise RuntimeError(
                f"Fallo el chunk {i // CHUNK_SIZE}: {resp.status_code} {resp.text}"
            )
        inserted = resp.json().get("inserted", len(chunk))
        total_inserted += inserted
        print(f"  chunk {i // CHUNK_SIZE + 1}: {inserted} jugadores")

    print(f"Listo: {total_inserted} jugadores importados/actualizados para {season}")


def main() -> None:
    season = os.environ.get("SEASON", "2026")
    print(f"Scrapeando FBref (comp {COMP_ID}) para temporada {season}...")
    players = scrape_all()
    print(f"Total de filas mergeadas: {len(players)}")
    if not players:
        raise RuntimeError("El scraping no devolvio ningun jugador, aborto sin escribir nada")
    push_to_supabase(players, season)


if __name__ == "__main__":
    main()
