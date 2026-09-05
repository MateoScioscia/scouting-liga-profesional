"""
Busca Contrato (fecha de fin) y Valor de mercado en Transfermarkt para
jugadores que todavia no se hayan revisado, y los sube a Supabase
(columna `players.contract_until` via `admin_update_media`, y una fila en
`market_values` via `admin_import_market_values`, ya existente para la
carga manual).

Un jugador queda excluido de futuras corridas (`transfermarkt_checked_at`
seteado) apenas se llega a su ficha real, tenga o no fecha de contrato
publicada -- muchos perfiles simplemente no la muestran, y no tiene
sentido reintentarlos para siempre. Un "sin resultado de busqueda" en
cambio NO marca al jugador como revisado, porque puede ser el bloqueo
anti-bot en vez de una ausencia real de ficha (ver mas abajo), y conviene
darle otra chance en una corrida futura.

A diferencia de FBref, Transfermarkt SI deja pasar a un navegador real:
un pedido simple con `requests` devuelve un desafio de AWS WAF (confirmado
con una prueba puntual), pero un contexto de Playwright lo resuelve solo y
llega al contenido real. Por eso este script usa un navegador real para
cada jugador -- mas lento que fetch_media.py (2 navegaciones por jugador
en vez de una llamada a una API JSON liviana), asi que correrlo para el
roster completo puede tardar bastante.

Es "best effort" pero MENOS estricto que el matching de Wikipedia: toma el
primer resultado de busqueda y solo lo descarta si la pagina de perfil no
tiene pinta de ser un jugador de futbol (no menciona "position"). No
verifica nacionalidad/equipo, asi que el riesgo de persona equivocada con
nombres comunes es mayor -- pensado para revisar antes de confiar
ciegamente en los datos.

    pip install requests beautifulsoup4 lxml playwright
    playwright install --with-deps chromium
    SUPABASE_URL=... SUPABASE_ANON_KEY=... ADMIN_PASSCODE=... \
        python scripts/fetch_transfermarkt.py
"""

from __future__ import annotations

import os
import re
import sys
import time
from datetime import date, datetime
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

PLAYER_FILTER = os.environ.get("PLAYER_FILTER", "").strip().lower()
# Corridas largas (cientos de jugadores en la misma sesion de browser)
# terminan gatillando el anti-bot de Transfermarkt a mitad de camino: deja
# de devolver resultados de busqueda reales (parece "sin resultado" para
# jugadores que si tienen ficha) y se queda asi el resto de la corrida.
# Limitando cuantos jugadores procesa cada corrida y repitiendo el workflow
# varias veces (cada uno con un runner/IP nuevo) evitamos sostener una
# sesion lo bastante larga como para que eso pase.
MAX_PLAYERS = int(os.environ.get("MAX_PLAYERS", "0") or "0") or None

BASE = "https://www.transfermarkt.com"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
CHUNK_SIZE = 150
NAV_TIMEOUT = 30000
CHALLENGE_WAIT_MS = 4000
# El lote completo tarda horas (2 navegaciones por jugador); subimos a
# Supabase cada tantos jugadores en vez de esperar al final, para no
# perder el progreso si el proceso se corta a mitad de camino.
SAVE_EVERY = 50

# Transfermarkt publica el valor en EUR; convertimos a USD con un tipo de
# cambio aproximado (no en vivo) porque el resto de la app usa dolares.
EUR_TO_USD_RATE = 1.08


def parse_money(text: str) -> float | None:
    m = re.search(r"€\s*([\d.,]+)\s*([kKmM]?)", text)
    if not m:
        return None
    amount = float(m.group(1).replace(",", ""))
    suffix = m.group(2).lower()
    if suffix == "k":
        amount *= 1_000
    elif suffix == "m":
        amount *= 1_000_000
    return amount


def parse_contract_date(text: str) -> str | None:
    text = text.strip()
    for fmt in ("%b %d, %Y", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def find_profile_url(page, name: str, debug: bool = False) -> str | None:
    search_url = f"{BASE}/schnellsuche/ergebnis/schnellsuche?query={quote(name)}"
    page.goto(search_url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
    page.wait_for_timeout(CHALLENGE_WAIT_MS)
    soup = BeautifulSoup(page.content(), "lxml")
    link = soup.select_one("table.items td.hauptlink a[href*='/profil/spieler/']")
    if not link or not link.get("href"):
        if debug:
            title = soup.title.get_text(strip=True) if soup.title else "(sin <title>)"
            body_len = len(soup.get_text(strip=True))
            # Si el titulo/tamano de pagina no parecen una busqueda real de
            # Transfermarkt, probablemente nos esta devolviendo el desafio
            # anti-bot en vez de resultados -- distingue eso de "el jugador
            # realmente no tiene ficha".
            print(f"    [debug] sin link de resultado. title={title!r} body_chars={body_len}")
        return None
    href = link["href"]
    return href if href.startswith("http") else f"{BASE}{href}"


CONTRACT_TEXT_RE = re.compile(
    r"contract expires:?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{1,2}[./]\d{1,2}[./]\d{4})", re.I
)


def scrape_profile(page, url: str, debug: bool = False) -> dict:
    page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT)
    page.wait_for_timeout(CHALLENGE_WAIT_MS)
    soup = BeautifulSoup(page.content(), "lxml")

    result: dict = {}

    page_text = soup.get_text(" ", strip=True)
    if "position" not in page_text.lower():
        return result  # no tiene pinta de ficha de jugador de futbol

    value_el = soup.select_one(".data-header__market-value-wrapper")
    if value_el:
        amount_eur = parse_money(value_el.get_text(" ", strip=True))
        if amount_eur:
            result["value_amount"] = round(amount_eur * EUR_TO_USD_RATE, 2)
            result["currency"] = "USD"

    # Buscamos por texto visible ("Contract expires: ...") en vez de solo
    # por clases CSS -- Transfermarkt cambia los nombres de clase seguido,
    # pero el texto es mas estable.
    m = CONTRACT_TEXT_RE.search(page_text)
    if m:
        iso = parse_contract_date(m.group(1))
        if iso:
            result["contract_until"] = iso
    elif debug:
        lower = page_text.lower()
        occurrences = [mo.start() for mo in re.finditer("contract", lower)]
        if not occurrences:
            print("    [debug] no matcheo contrato. 'contract' no aparece en la pagina.")
        else:
            print(f"    [debug] no matcheo contrato. {len(occurrences)} apariciones de 'contract':")
            for idx in occurrences[:8]:
                snippet = page_text[max(0, idx - 30) : idx + 120]
                print(f"      - {snippet!r}")

    return result


def fetch_players(supabase_url: str, headers: dict) -> list[dict]:
    if PLAYER_FILTER:
        filter_clause = f"full_name=ilike.*{quote(PLAYER_FILTER)}*"
    else:
        filter_clause = "transfermarkt_checked_at=is.null&order=full_name.asc"
        if MAX_PLAYERS:
            filter_clause += f"&limit={MAX_PLAYERS}"
    resp = requests.get(
        f"{supabase_url}/rest/v1/players?select=id,full_name,nationality&{filter_clause}",
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def push_player_updates(supabase_url: str, headers: dict, passcode: str, updates: list[dict]) -> None:
    if not updates:
        print("Sin contrato/estatura para actualizar en players.")
        return
    endpoint = f"{supabase_url}/rest/v1/rpc/admin_update_media"
    for i in range(0, len(updates), CHUNK_SIZE):
        chunk = updates[i : i + CHUNK_SIZE]
        payload = {"passcode": passcode, "players": chunk, "teams": []}
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=60)
        if resp.status_code >= 300:
            raise RuntimeError(f"Fallo actualizando players chunk {i // CHUNK_SIZE}: {resp.status_code} {resp.text}")
        print(f"  players chunk {i // CHUNK_SIZE + 1}: {resp.json()}")


def push_market_values(supabase_url: str, headers: dict, passcode: str, rows: list[dict]) -> None:
    if not rows:
        print("Sin valores de mercado para cargar.")
        return
    endpoint = f"{supabase_url}/rest/v1/rpc/admin_import_market_values"
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i : i + CHUNK_SIZE]
        payload = {"passcode": passcode, "rows": chunk}
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=60)
        if resp.status_code >= 300:
            raise RuntimeError(f"Fallo cargando market_values chunk {i // CHUNK_SIZE}: {resp.status_code} {resp.text}")
        print(f"  market_values chunk {i // CHUNK_SIZE + 1}: {resp.json()}")


def main() -> None:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    passcode = os.environ["ADMIN_PASSCODE"]

    read_headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
    write_headers = {**read_headers, "Content-Type": "application/json"}

    players = fetch_players(supabase_url, read_headers)
    print(f"Buscando contrato/valor para {len(players)} jugadores...")

    player_updates: list[dict] = []
    market_value_rows: list[dict] = []
    today = date.today().isoformat()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT, locale="en-US")
        page = context.new_page()

        for i, player in enumerate(players, 1):
            try:
                profile_url = find_profile_url(page, player["full_name"], debug=bool(PLAYER_FILTER))
                if not profile_url:
                    print(f"  --  {player['full_name']}: sin resultado de busqueda")
                    continue
                data = scrape_profile(page, profile_url, debug=bool(PLAYER_FILTER))
            except Exception as exc:  # noqa: BLE001 - seguimos con el resto si uno falla
                print(f"  ERROR con {player['full_name']}: {exc}", file=sys.stderr)
                continue

            if data:
                # Llegamos a una ficha real (paso el chequeo de "position"),
                # aunque no siempre traiga contrato -- algunos perfiles no
                # publican esa fecha. Marcamos como revisado para no
                # reprocesarlo en cada tanda; un "sin resultado de busqueda"
                # (mas abajo) en cambio NO se marca, porque puede ser el
                # bloqueo anti-bot en vez de una ausencia real, y conviene
                # reintentarlo en una tanda futura.
                update: dict = {"id": player["id"], "transfermarkt_checked_at": datetime.now().isoformat()}
                if data.get("contract_until"):
                    update["contract_until"] = data["contract_until"]
                player_updates.append(update)
            if data.get("value_amount"):
                market_value_rows.append(
                    {
                        "full_name": player["full_name"],
                        "nationality": player.get("nationality") or "",
                        "value_date": today,
                        "value_amount": data["value_amount"],
                        "currency": data.get("currency", "USD"),
                        "source": "transfermarkt",
                    }
                )
            if data:
                print(f"  OK  {player['full_name']}: {data}")

            if i % 25 == 0:
                print(f"  ...{i}/{len(players)} procesados")

            if i % SAVE_EVERY == 0:
                print(f"  -- guardando progreso ({len(player_updates)} revisados, {len(market_value_rows)} valores) --")
                push_player_updates(supabase_url, write_headers, passcode, player_updates)
                push_market_values(supabase_url, write_headers, passcode, market_value_rows)
                player_updates = []
                market_value_rows = []

        browser.close()

    print(f"Restantes sin guardar: {len(player_updates)} revisados, {len(market_value_rows)} valores")
    push_player_updates(supabase_url, write_headers, passcode, player_updates)
    push_market_values(supabase_url, write_headers, passcode, market_value_rows)
    print("Listo.")


if __name__ == "__main__":
    main()
