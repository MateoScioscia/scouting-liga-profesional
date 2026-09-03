"""
Genera un resumen tipo "scouting report" por jugador con Claude, a partir de
sus estadisticas reales de la temporada (percentiles dentro de su grupo
posicional), y lo carga a Supabase via `admin_update_media`.

El prompt deja explicito que el modelo NO debe inventar datos que no esten
en el contexto (altura, pie habil, contrato, "potencial", comparaciones con
jugadores famosos, etc.) -- solo puede describir lo que se ve en las
estadisticas reales. Es idempotente: solo genera resumen para jugadores que
todavia no tienen uno (`ai_summary is null`), asi que correrlo de nuevo solo
cubre a los jugadores nuevos.

    pip install requests anthropic
    SUPABASE_URL=... SUPABASE_ANON_KEY=... ADMIN_PASSCODE=... \
        ANTHROPIC_API_KEY=... python scripts/generate_summaries.py
"""

from __future__ import annotations

import os
import sys
import time

import anthropic
import requests

SEASON = os.environ.get("SEASON", "2026")
MODEL = "claude-haiku-4-5-20251001"
CHUNK_SIZE = 150
REQUEST_DELAY = 0.2

# Mismo criterio que PERCENTILE_GROUPS en web/src/lib/metrics.ts
CATEGORY_METRICS = {
    "FWD": {
        "Finalizacion": ["goles_p90", "goles_sin_penal", "tiros_p90", "pct_tiros_al_arco", "goles_por_tiro"],
        "Creacion": ["asistencias_p90", "centros_p90", "faltas_recibidas"],
        "Disciplina": ["faltas_p90"],
    },
    "MID": {
        "Creacion": ["asistencias_p90", "centros_p90", "faltas_recibidas"],
        "Ataque": ["goles_p90", "tiros_p90"],
        "Defensa": ["intercepciones_p90", "entradas_p90"],
        "Disciplina": ["faltas_p90"],
    },
    "DEF": {
        "Defensa": ["intercepciones_p90", "entradas_p90"],
        "Aporte ofensivo": ["goles_p90", "asistencias_p90", "centros_p90"],
        "Disciplina": ["faltas_p90"],
    },
    "GK": {
        "Paradas": ["pct_atajadas", "goles_recibidos_p90", "pct_vallas_invictas"],
        "Penales": ["penales_atajados"],
    },
}
LOWER_IS_BETTER = {"faltas_p90", "goles_recibidos_p90"}
CORE_FIELDS = {"matches_played", "starts", "minutes_played", "nineties", "goals", "assists", "yellow_cards", "red_cards"}

LABELS = {
    "goles_p90": "goles cada 90 minutos",
    "goles_sin_penal": "goles sin contar penales",
    "tiros_p90": "tiros cada 90 minutos",
    "pct_tiros_al_arco": "% de tiros al arco",
    "goles_por_tiro": "goles por tiro",
    "asistencias_p90": "asistencias cada 90 minutos",
    "centros_p90": "centros cada 90 minutos",
    "faltas_recibidas": "faltas recibidas",
    "faltas_p90": "faltas cometidas cada 90 minutos",
    "intercepciones_p90": "intercepciones cada 90 minutos",
    "entradas_p90": "entradas ganadas cada 90 minutos",
    "pct_atajadas": "% de atajadas",
    "goles_recibidos_p90": "goles recibidos cada 90 minutos",
    "pct_vallas_invictas": "% de vallas invictas",
    "penales_atajados": "penales atajados",
}

PROMPT_TEMPLATE = """Sos un analista de datos de scouting de futbol. Te paso estadisticas reales
de un jugador de la Liga Profesional Argentina (temporada {season}), ya comparadas en percentil
contra otros jugadores de su misma posicion en la liga.

Escribi un resumen de 3 a 5 oraciones en espanol rioplatense, tono profesional y directo,
describiendo su rendimiento estadistico esta temporada: que hace bien, que le falta, en base
UNICAMENTE a los numeros de abajo.

Reglas estrictas:
- NO inventes datos que no esten en el contexto (nada de altura, pie habil, contrato, fichajes,
  "potencial", comparaciones con otros jugadores famosos, ni nada que no se pueda leer en las
  estadisticas).
- Si jugo pocos minutos, aclaralo y no saques conclusiones fuertes.
- No uses vinietas ni titulos, un solo parrafo.

Estadisticas:
{context}
"""


def get_stat(row: dict, key: str):
    if key in CORE_FIELDS:
        return row.get(key)
    return (row.get("stats") or {}).get(key)


def percentile(sorted_vals: list[float], v: float) -> float:
    if not sorted_vals:
        return 0.0
    below = sum(1 for x in sorted_vals if x < v)
    equal = sum(1 for x in sorted_vals if x == v)
    return round(100 * (below + 0.5 * equal) / len(sorted_vals), 1)


def fetch_rows(supabase_url: str, headers: dict) -> list[dict]:
    resp = requests.get(
        f"{supabase_url}/rest/v1/player_season_stats"
        f"?select=id,player_id,matches_played,minutes_played,goals,assists,stats,"
        f"players(id,full_name,position_group,ai_summary,teams(name))"
        f"&season=eq.{SEASON}",
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return [r for r in resp.json() if r.get("players") and r["players"].get("position_group")]


def build_context(row: dict, pool: list[dict]) -> str:
    player = row["players"]
    pos = player["position_group"]
    lines = [
        f"Jugador: {player['full_name']}",
        f"Posicion: {pos}",
        f"Equipo: {(player.get('teams') or {}).get('name', 'sin equipo')}",
        f"Partidos jugados: {row.get('matches_played') or 0}, Minutos: {row.get('minutes_played') or 0}",
        f"Goles: {row.get('goals') or 0}, Asistencias: {row.get('assists') or 0}",
    ]
    for category, keys in CATEGORY_METRICS.get(pos, {}).items():
        parts = []
        for key in keys:
            value = get_stat(row, key)
            if value is None:
                continue
            pool_values = sorted(v for v in (get_stat(r, key) for r in pool) if v is not None)
            pct = percentile(pool_values, value)
            if key in LOWER_IS_BETTER:
                pct = 100 - pct
            parts.append(f"{LABELS.get(key, key)}: {value} (percentil {pct:.0f} entre {pos})")
        if parts:
            lines.append(f"{category}: " + "; ".join(parts))
    return "\n".join(lines)


def generate_summary(client: anthropic.Anthropic, context: str) -> str:
    msg = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": PROMPT_TEMPLATE.format(season=SEASON, context=context)}],
    )
    return "".join(block.text for block in msg.content if block.type == "text").strip()


def push_summaries(supabase_url: str, headers: dict, passcode: str, updates: list[dict]) -> None:
    if not updates:
        print("Nada para actualizar.")
        return
    endpoint = f"{supabase_url}/rest/v1/rpc/admin_update_media"
    for i in range(0, len(updates), CHUNK_SIZE):
        chunk = updates[i : i + CHUNK_SIZE]
        payload = {"passcode": passcode, "players": chunk, "teams": []}
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=60)
        if resp.status_code >= 300:
            raise RuntimeError(f"Fallo el chunk {i // CHUNK_SIZE}: {resp.status_code} {resp.text}")
        print(f"  chunk {i // CHUNK_SIZE + 1}: {resp.json()}")


def main() -> None:
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    passcode = os.environ["ADMIN_PASSCODE"]
    anthropic_key = os.environ["ANTHROPIC_API_KEY"]

    read_headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}
    write_headers = {**read_headers, "Content-Type": "application/json"}
    client = anthropic.Anthropic(api_key=anthropic_key)

    rows = fetch_rows(supabase_url, read_headers)
    pending = [r for r in rows if not r["players"].get("ai_summary")]
    print(f"{len(rows)} jugadores con stats {SEASON}, {len(pending)} sin resumen todavia.")

    pools: dict[str, list[dict]] = {}
    for r in rows:
        pools.setdefault(r["players"]["position_group"], []).append(r)

    updates: list[dict] = []
    for i, row in enumerate(pending, 1):
        player = row["players"]
        context = build_context(row, pools.get(player["position_group"], []))
        try:
            summary = generate_summary(client, context)
        except Exception as exc:  # noqa: BLE001 - seguimos con el resto si un jugador falla
            print(f"  ERROR con {player['full_name']}: {exc}", file=sys.stderr)
            continue
        updates.append({"id": player["id"], "ai_summary": summary})
        if i % 25 == 0:
            print(f"  ...{i}/{len(pending)} generados")
        time.sleep(REQUEST_DELAY)

    print(f"Resumenes generados: {len(updates)}")
    push_summaries(supabase_url, write_headers, passcode, updates)
    print("Listo.")


if __name__ == "__main__":
    main()
