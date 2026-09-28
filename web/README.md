# Seguimiento de Futbolistas

App de seguimiento de jugadores del fútbol argentino: indicadores, filtros por temporada, país y
liga, radar de percentiles, evolución por temporada, historial de lesiones y comparación de
jugadores, pensada para quienes reclutan por habilidades, rendimiento o precio.

Stack: Next.js (App Router) + Tailwind CSS + Supabase (Postgres) + Recharts. Deploy en Vercel.

## Desarrollo local

```bash
npm install
npm run dev
```

La app usa el proyecto de Supabase público de esta app por defecto (ver `src/lib/supabase.ts`).
Si querés apuntar a otro proyecto, copiá `.env.example` a `.env.local` y completá:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Estructura

- `src/app/jugadores` — listado con filtros (temporada, país, liga, posición, equipo, nacionalidad,
  minutos). Con la posición Arquero la tabla muestra Arc en 0 (arco en 0), GC (goles en contra) y
  PPP (paradas por partido).
- `src/app/jugadores/[id]` — perfil de jugador por temporada (`?temporada=2025`): indicadores, radar
  de percentiles, valor de mercado, evolución temporada por temporada e historial de lesiones.
- `src/app/comparar` — comparación de hasta 4 jugadores lado a lado.
- `src/app/cargar-datos` — carga de estadísticas y valor de mercado desde CSV/Excel, protegida
  por un código de acceso (ver más abajo).
- `scripts/build-import-sql.mjs` / `scripts/import-fbref-csv.mjs` — importación masiva inicial
  del CSV de FBref a Supabase.

## Base de datos (Supabase)

Las migraciones nuevas viven en `supabase/migrations/` (en la raíz del repo).

Tablas: `leagues` (Primera División a Primera C), `teams`, `players`, `player_season_stats` (una
fila por jugador × temporada × liga; columnas core + `stats` jsonb para métricas adicionales),
`market_values` y `player_injuries`.

`player_injuries` guarda datos de salud (sensibles según la Ley 25.326): no tiene lectura
pública. Se lee con la RPC `get_player_injuries` y se carga con `admin_import_injuries`, las dos
con el código de acceso. Las escrituras van siempre a través de funciones RPC
(`admin_import_players`, `admin_import_market_values`) protegidas por un código de acceso
(passcode) hasheado en la tabla `app_config` — no se usa una service role key en el cliente.

El código de acceso por defecto es `scouting-lpf-2026`. Para cambiarlo, ejecutá en el SQL editor
de Supabase:

```sql
select admin_set_passcode('scouting-lpf-2026', 'tu-nuevo-codigo');
```
