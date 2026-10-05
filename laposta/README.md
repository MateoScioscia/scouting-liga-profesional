# Estacionamiento — La Posta

Mini web app (HTML + CSS + JS vanilla, sin build) para registrar ingresos y cobrar salidas. Mobile-first, funciona también en PC.

## Deploy en Vercel
1. Importar el repo en Vercel.
2. **Root Directory:** `laposta` · Framework Preset: *Other* · sin build command ni output directory.
3. Deploy.

Local: `npm start` (sirve estáticos en :3000) · Tests: `npm test`.

## Estructura (patrón en capas)
| Capa | Archivo |
|---|---|
| Interfaz | `index.html`, `css/styles.css` |
| Gestión de UI | `js/app.js` |
| Lógica de negocio (pura, testeada) | `js/logic.js` |
| Soporte / persistencia | `localStorage` del navegador (ver abajo) |

## Requerimientos → implementación
| Req. | Dónde |
|---|---|
| ID = patente + categoría (Auto/Moto/Camioneta) | `validatePlate`, `registerEntry` |
| Estadía desde carga hasta ticket de salida, 24 HS | `stayMinutes`, `formatClock`, ticket en `registerExit` |
| Pagos: efectivo, débito, crédito, QR | `PAYMENT_METHODS` |
| Precio por categoría y tramos 1/12/24 HS, tolerancia 15 min, igual para todo método | `TARIFFS`, `computeFee` |
| Cobro solo si está registrado | `quoteExit` (`NOT_FOUND`, `ALREADY_EXITED`) |
| Efectivo: monto manual + vuelto automático | `computeChange`, `registerExit` |
| Borrado 24 HS tras la salida | `purgeExpired` (cada 30 s y al abrir) |
| Cobro < 1 min | flujo de 3 toques desde "Cobrar" en la lista de activos |

## Hipótesis a validar con el cliente
- **Tarifas**: no están en los requerimientos. Valores de ejemplo en `TARIFFS` (Auto 800/5.000/8.000, Moto 500/3.000/5.000, Camioneta 1.100/6.500/10.000), coherentes con el mockup (Auto 51 min = $800).
- **Más de 24 h**: se cobra un bloque 24 HS por día completo y el resto con las mismas reglas.
- **Persistencia**: sin base de datos ni servidor. El estado vive en el `localStorage` del dispositivo (para que recargar no borre los autos), por lo que **cada dispositivo ve su propio listado**. Si el playero usa varios celulares a la vez, haría falta un backend compartido (con borrado a 24 h).
- Hora local del dispositivo.

## Casos de prueba
`tests/logic.test.js` (unitarias + sistema sobre la lógica): patente, límites de tramo (0/60/75/76/735/736/1455/1456 min…), tolerancia, vuelto, monto insuficiente, métodos sin vuelto, doble cobro, no registrado, reingreso, purga a las 24 h exactas.
Además se ejecutó una prueba de caja negra en Chromium (375 px, 320 px y 1280 px) cubriendo el flujo completo.
