"""
Segundo intento (descartable) de acceso a Transfermarkt, esta vez con un
navegador real via Playwright -- el desafio que devolvio la prueba con
`requests` fue un AWS WAF challenge.js, que un navegador real puede llegar
a resolver solo (a diferencia del bloqueo puro por IP que nos freno con
FBref). No toca la base de datos.
"""

from __future__ import annotations

from playwright.sync_api import sync_playwright

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT, locale="en-US")
        page = context.new_page()

        url = "https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=Fernando+Muslera"
        print(f"Navegando a {url}")
        resp = page.goto(url, wait_until="domcontentloaded", timeout=30000)
        print("status inicial:", resp.status if resp else None)

        # Le damos tiempo al challenge.js de AWS WAF para resolver y recargar
        page.wait_for_timeout(6000)

        title = page.title()
        content = page.content()
        print("title final:", title)
        print("largo del HTML final:", len(content))
        print("---- primeros 2000 caracteres ----")
        print(content[:2000])

        browser.close()


if __name__ == "__main__":
    main()
