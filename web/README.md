# Scouting LPF — Análisis de jugadores

App de scouting para la Liga Profesional Argentina: KPIs, filtros, radar de percentiles y
comparación de jugadores, pensada para quienes reclutan por habilidades, performance o precio.

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

- `src/app/jugadores` — listado con filtros (posición, equipo, nacionalidad, minutos).
- `src/app/jugadores/[id]` — perfil de jugador: KPIs, radar de percentiles, valor de mercado.
- `src/app/comparar` — comparación de hasta 4 jugadores lado a lado.
- `src/app/cargar-datos` — carga de estadísticas y valor de mercado desde CSV/Excel, protegida
  por un código de acceso (ver más abajo).
- `scripts/build-import-sql.mjs` / `scripts/import-fbref-csv.mjs` — importación masiva inicial
  del CSV de FBref a Supabase.

## Base de datos (Supabase)

Tablas: `teams`, `players`, `player_season_stats` (columnas core + `stats` jsonb para métricas
adicionales), `market_values`. Las escrituras van siempre a través de funciones RPC
(`admin_import_players`, `admin_import_market_values`) protegidas por un código de acceso
(passcode) hasheado en la tabla `app_config` — no se usa una service role key en el cliente.

El código de acceso por defecto es `scouting-lpf-2026`. Para cambiarlo, ejecutá en el SQL editor
de Supabase:

```sql
select admin_set_passcode('scouting-lpf-2026', 'tu-nuevo-codigo');
```
