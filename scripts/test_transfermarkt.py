"""
Prueba descartable: solo chequea si Transfermarkt deja pasar pedidos desde
un runner de GitHub Actions (misma pregunta que ya nos resolvio "no" con
FBref via Cloudflare). No toca la base de datos.
"""

from __future__ import annotations

import requests

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def main() -> None:
    resp = requests.get(
        "https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche",
        params={"query": "Fernando Muslera"},
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout=20,
    )
    print("status:", resp.status_code)
    print("headers:", dict(resp.headers))
    print("---- primeros 3000 caracteres del body ----")
    print(resp.text[:3000])


if __name__ == "__main__":
    main()
