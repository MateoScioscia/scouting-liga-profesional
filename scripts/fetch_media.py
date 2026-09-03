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
"""

from __future__ import annotations

import os
import sys
import time

import requests

WIKI_API = "https://es.wikipedia.org/w/api.php"
USER_AGENT = "ScoutingLPFBot/1.0 (https://github.com/MateoScioscia/scouting-liga-profesional; contacto via GitHub)"
REQUEST_DELAY = 0.3
CHUNK_SIZE = 150

FOOTBALLER_HINTS = ("futbolista", "futbol")
DISAMBIGUATION_HINTS = ("puede referirse a", "puede referirse:")


def wiki_search_image(query: str, require_footballer: bool) -> str | None:
    """Busca en Wikipedia y devuelve la miniatura de la pagina mas relevante,
    o None si no hay resultado confiable."""
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": query,
        "gsrlimit": 1,
        "prop": "pageimages|extracts",
        "piprop": "thumbnail",
        "pithumbsize": 400,
        "exintro": 1,
        "explaintext": 1,
        "exchars": 400,
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
    return thumbnail.get("source")


def fetch_teams(supabase_url: str, headers: dict) -> list[dict]:
    resp = requests.get(f"{supabase_url}/rest/v1/teams?select=id,name", headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_players(supabase_url: str, headers: dict) -> list[dict]:
    resp = requests.get(
        f"{supabase_url}/rest/v1/players?select=id,full_name,photo_url&photo_url=is.null",
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

    teams = fetch_teams(supabase_url, read_headers)
    print(f"Buscando escudos para {len(teams)} equipos...")
    team_updates: list[dict] = []
    for team in teams:
        url = wiki_search_image(f"{team['name']} club de futbol escudo", require_footballer=False)
        time.sleep(REQUEST_DELAY)
        if url:
            team_updates.append({"id": team["id"], "logo_url": url})
            print(f"  OK  {team['name']}")
        else:
            print(f"  --  {team['name']} (sin resultado confiable)")

    players = fetch_players(supabase_url, read_headers)
    print(f"Buscando fotos para {len(players)} jugadores sin foto...")
    player_updates: list[dict] = []
    for i, player in enumerate(players, 1):
        url = wiki_search_image(f"{player['full_name']} futbolista argentino", require_footballer=True)
        time.sleep(REQUEST_DELAY)
        if url:
            player_updates.append({"id": player["id"], "photo_url": url})
        if i % 50 == 0:
            print(f"  ...{i}/{len(players)} procesados, {len(player_updates)} con foto")

    print(f"Escudos encontrados: {len(team_updates)}/{len(teams)}")
    print(f"Fotos encontradas: {len(player_updates)}/{len(players)}")

    push_media(supabase_url, write_headers, passcode, player_updates, team_updates)
    print("Listo.")


if __name__ == "__main__":
    main()
