# Club Atlético Vecinal — Alta de socio

Sitio estático (HTML + CSS + JS vanilla, sin build) que implementa la pantalla "Alta de socio" del diseño, con sus pop-ups, mensajes de validación y reglas. Responsive: escritorio como en el diseño, una columna en celular.

## Deploy en Vercel
Importar el repo con **Root Directory = `club-vecinal`**, Framework *Other*, sin build command ni output directory.
Local: `npm start` · Tests: `npm test`.

## Qué implementa (del diseño)
| Diseño | Implementación |
|---|---|
| 1. Pantalla principal | `index.html` (`#tpl-alta`), `js/alta.js` |
| 2. Pop-up prevención de pérdida de datos | Cancelar con datos, navegar con datos cargados, cerrar pestaña (`beforeunload`) |
| 3. Pop-up alta exitosa | `showSuccess` en `js/alta.js` |
| 4/7. Mensajes de validación | `js/rules.js` (`MSG`, validadores) |
| 5. Lógica interna | edad/categoría automáticas, bloque tutor solo si < 18, horarios por actividad con cupo, vencimiento = emisión + 1 año |
| 6. Suposiciones | edad > 3 y < 129; Menor 4–12, Cadete 13–17, Mayor 18–128 |

Pantallas de destino de los botones (no estaban en el diseño): **Listado de socios**, **Ficha del socio**, más **Actividades** (cupos) y **Reportes** (alertas de certificado).

## Simulaciones y límites (importante)
- **Sin backend**: los socios se guardan en el `localStorage` del navegador (cada dispositivo ve los suyos). `js/store.js` es el único punto a reemplazar por una API/Supabase.
- **DNI "persona real"** (suposición 4): `js/registry.js` simula el servicio externo (rechaza DNI repetidos como `11111111` o menores a 1.000.000). Reemplazar por la integración real.
- **Correo de confirmación y alerta a 30 días**: el pop-up lo informa como en el diseño, pero **no se envía ningún mail**; la alerta se refleja en *Reportes* y en la ficha.
- Actividades y cupos son datos de ejemplo (`js/store.js`); el primer grupo reproduce el del diseño (12/20, 20/20 Completo, 5/20).
- Mensajes no especificados en el diseño (teléfono, fecha de emisión futura, foto) fueron redactados en el mismo estilo.

## Tests
`tests/rules.test.js`: formatos, rangos de edad y categoría, fechas límite, vencimiento (incluye 29/02), alerta a 30 días, DNI, teléfono, email, foto.
Además se ejecutó una prueba de caja negra en Chromium (1280, 375 y 320 px, 53 chequeos) cubriendo el flujo completo.
