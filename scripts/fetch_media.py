"""
Busca escudos de equipo y fotos de jugadores en Wikipedia (es.wikipedia.org)
y los carga a Supabase via la funcion RPC `admin_update_media`.

Pensado para correr en GitHub Actions (disparo manual), pero tambien se
puede correr en local:

    pip install -r scripts/requirements.txt
    SUPABASE_URL=... SUPABASE_ANON_KEY=... ADMIN_PASSCODE=... \
        python scripts/fetch_media.py

A diferencia de FBref, la API de Wikipedia no tiene proteccion anti-bot por
reputacion de IP, asi que un `requests` simple con un User-Agent
identificable (requisito de la politica de Wikimedia) funciona bien.

Es "best effort": para jugadores solo se acepta una foto si el resultado de
busqueda mas relevante es claramente un futbolista (el extracto menciona
"futbolista"/"futbol") y no una pagina de desambiguacion -- si hay duda, se
deja sin foto en vez de arriesgar una foto de la persona equivocada. Los que
queden sin foto se pueden cargar a mano despues (columna `photo_url`).

Tambien intenta la estatura (`height_cm`) via Wikidata (propiedad P2048),
reusando el mismo match de Wikipedia que la foto -- Wikidata es un origen
estructurado (no HTML a parsear) y no tiene proteccion anti-bot.
"""

from __future__ import annotations

import os
import sys
import time
from urllib.parse import quote

import requests

PLAYER_FILTER = os.environ.get("PLAYER_FILTER", "").strip()

WIKI_API = "https://es.wikipedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
USER_AGENT = "ScoutingLPFBot/1.0 (https://github.com/MateoScioscia/scouting-liga-profesional; contacto via GitHub)"
REQUEST_DELAY = 0.3
CHUNK_SIZE = 150

FOOTBALLER_HINTS = ("futbolista", "futbol")
DISAMBIGUATION_HINTS = ("puede referirse a", "puede referirse:")
HEIGHT_PROPERTY = "P2048"  # "estatura" en Wikidata


def wiki_search_page(query: str, require_footballer: bool) -> dict | None:
    """Busca en Wikipedia y devuelve {photo_url, wikibase_item} de la pagina
    mas relevante, o None si no hay resultado confiable."""
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": query,
        "gsrlimit": 1,
        "prop": "pageimages|extracts|pageprops",
        "piprop": "thumbnail",
        "pithumbsize": 400,
        "exintro": 1,
        "explaintext": 1,
        "exchars": 400,
        "ppprop": "wikibase_item",
    }
    resp = requests.get(WIKI_API, params=params, headers={"User-Agent": USER_AGENT}, timeout=20)
    resp.raise_for_status()
    pages = (resp.json().get("query") or {}).get("pages") or {}
    if not pages:
        return None
    page = next(iter(pages.values()))
    extract = (page.get("extract") or "").lower()

    if any(h in extract for h in DISAMBIGUATION_HINTS):
        return None
    if require_footballer and not any(h in extract for h in FOOTBALLER_HINTS):
        return None

    thumbnail = page.get("thumbnail") or {}
    return {
        "photo_url": thumbnail.get("source"),
        "wikibase_item": (page.get("pageprops") or {}).get("wikibase_item"),
    }


# Unidades que puede traer P2048 en Wikidata (URI completo de la entidad).
# Wikidata mezcla metros y centimetros segun quien haya cargado el dato --
# asumir siempre una es como quedo "191 m" para Muslera.
WIKIDATA_METRE = "http://www.wikidata.org/entity/Q11573"
WIKIDATA_CENTIMETRE = "http://www.wikidata.org/entity/Q174728"


def wiki_get_height_cm(wikibase_item: str | None) -> int | None:
    if not wikibase_item:
        return None
    resp = requests.get(
        WIKIDATA_API,
        params={"action": "wbgetclaims", "entity": wikibase_item, "property": HEIGHT_PROPERTY, "format": "json"},
        headers={"User-Agent": USER_AGENT},
        timeout=20,
    )
    resp.raise_for_status()
    claims = (resp.json().get("claims") or {}).get(HEIGHT_PROPERTY) or []
    if not claims:
        return None
    try:
        value = claims[0]["mainsnak"]["datavalue"]["value"]
        amount = float(value["amount"].lstrip("+"))
        unit = value.get("unit", "")
        if unit == WIKIDATA_METRE:
            height_cm = round(amount * 100)
        elif unit == WIKIDATA_CENTIMETRE:
            height_cm = round(amount)
        else:
            return None  # unidad desconocida -- mejor no adivinar
        if not (140 <= height_cm <= 220):
            return None  # fuera de rango humano razonable, probablemente mal dato
        return height_cm
    except (KeyError, TypeError, ValueError):
        return None


def fetch_teams(supabase_url: str, headers: dict) -> list[dict]:
    resp = requests.get(f"{supabase_url}/rest/v1/teams?select=id,name", headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_players(supabase_url: str, headers: dict) -> list[dict]:
    if PLAYER_FILTER:
        # Corrida puntual para un jugador (o varios que matcheen el nombre) --
        # ignora si ya tiene foto/estatura, para poder forzar un refresh.
        filter_clause = f"full_name=ilike.*{quote(PLAYER_FILTER)}*"
    else:
        filter_clause = "or=(photo_url.is.null,height_cm.is.null)"
    resp = requests.get(
        f"{supabase_url}/rest/v1/players?select=id,full_name,photo_url,height_cm&{filter_clause}",
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def push_media(supabase_url: str, headers: dict, passcode: str, players: list[dict], teams: list[dict]) -> None:
    endpoint = f"{supabase_url}/rest/v1/rpc/admin_update_media"
    if not players and not teams:
        print("Nada para actualizar.")
        return

    for kind, rows in (("players", players), ("teams", teams)):
        for i in range(0, len(rows), CHUNK_SIZE):
            chunk = rows[i : i + CHUNK_SIZE]
            payload = {
                "passcode": passcode,
                "players": chunk if kind == "players" else [],
                "teams": chunk if kind == "teams" else [],
            }
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=60)
            if resp.status_code >= 300:
                raise RuntimeError(f"Fallo actualizando {kind} chunk {i // CHUNK_SIZE}: {resp.status_code} {resp.text}")
            print(f"  {kind} chunk {i // CHUNK_SIZE + 1}: {resp.json()}")


def main() -> None:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    passcode = os.environ["ADMIN_PASSCODE"]

    read_headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
    write_headers = {**read_headers, "Content-Type": "application/json"}

    team_updates: list[dict] = []
    teams: list[dict] = []
    if PLAYER_FILTER:
        print(f"PLAYER_FILTER={PLAYER_FILTER!r}: corrida puntual, salteo la busqueda de escudos.")
    else:
        teams = fetch_teams(supabase_url, read_headers)
        print(f"Buscando escudos para {len(teams)} equipos...")
        for team in teams:
            page = wiki_search_page(f"{team['name']} club de futbol escudo", require_footballer=False)
            time.sleep(REQUEST_DELAY)
            if page and page.get("photo_url"):
                team_updates.append({"id": team["id"], "logo_url": page["photo_url"]})
                print(f"  OK  {team['name']}")
            else:
                print(f"  --  {team['name']} (sin resultado confiable)")

    players = fetch_players(supabase_url, read_headers)
    print(f"Buscando fotos/estatura para {len(players)} jugadores incompletos...")
    player_updates: list[dict] = []
    heights_found = 0
    for i, player in enumerate(players, 1):
        page = wiki_search_page(f"{player['full_name']} futbolista argentino", require_footballer=True)
        time.sleep(REQUEST_DELAY)
        update: dict = {}
        if page:
            if page.get("photo_url") and not player.get("photo_url"):
                update["photo_url"] = page["photo_url"]
            if not player.get("height_cm"):
                height = wiki_get_height_cm(page.get("wikibase_item"))
                time.sleep(REQUEST_DELAY)
                if height:
                    update["height_cm"] = height
                    heights_found += 1
        if update:
            player_updates.append({"id": player["id"], **update})
        if i % 50 == 0:
            print(f"  ...{i}/{len(players)} procesados, {len(player_updates)} con algun dato nuevo")

    print(f"Escudos encontrados: {len(team_updates)}/{len(teams)}")
    print(f"Jugadores con algun dato nuevo: {len(player_updates)}/{len(players)} (estatura: {heights_found})")

    push_media(supabase_url, write_headers, passcode, player_updates, team_updates)
    print("Listo.")


if __name__ == "__main__":
    main()
