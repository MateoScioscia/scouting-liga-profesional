-- Ligas, temporadas por liga e historial de lesiones.
-- Solo agrega: no borra tablas ni datos. Las filas existentes de
-- player_season_stats quedan asignadas a la Primera División (LPF).

-- 1. Ligas -------------------------------------------------------------------
create table if not exists public.leagues (
  id text primary key,
  name text not null,
  short_name text not null,
  country text not null,
  tier smallint not null check (tier between 1 and 10)
);

insert into public.leagues (id, name, short_name, country, tier) values
  ('LPF', 'Primera División (Liga Profesional)', 'Primera División', 'Argentina', 1),
  ('PN',  'Primera Nacional',                    'Primera Nacional', 'Argentina', 2),
  ('BM',  'Primera B Metropolitana',             'Primera B Metro',  'Argentina', 3),
  ('FA',  'Torneo Federal A',                    'Federal A',        'Argentina', 3),
  ('PC',  'Primera C',                           'Primera C',        'Argentina', 4)
on conflict (id) do update set
  name = excluded.name, short_name = excluded.short_name, country = excluded.country, tier = excluded.tier;

alter table public.leagues enable row level security;
drop policy if exists "public read leagues" on public.leagues;
create policy "public read leagues" on public.leagues for select using (true);

-- 2. Liga de cada temporada ----------------------------------------------------
-- La liga va en la fila de estadísticas (jugador × temporada × liga) y no en el
-- club, porque un club asciende o desciende entre temporadas.
alter table public.player_season_stats
  add column if not exists league_id text not null default 'LPF' references public.leagues(id);

create index if not exists player_season_stats_season_league_idx
  on public.player_season_stats (season, league_id);

-- Un jugador puede tener estadísticas en dos ligas la misma temporada (préstamo).
alter table public.player_season_stats drop constraint if exists player_season_stats_player_id_season_key;
alter table public.player_season_stats
  add constraint player_season_stats_player_season_league_key unique (player_id, season, league_id);

-- admin_import_players: mismo comportamiento de antes + parámetro de liga
-- (por defecto LPF, así los scripts y la pantalla de carga actuales siguen andando).
drop function if exists public.admin_import_players(text, text, jsonb);
create or replace function public.admin_import_players(passcode text, p_season text, rows jsonb, p_league text default 'LPF')
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r jsonb;
  v_team_id uuid;
  v_player_id uuid;
  inserted_count int := 0;
begin
  if not check_admin_passcode(passcode) then
    raise exception 'invalid passcode';
  end if;

  if not exists (select 1 from leagues where id = p_league) then
    raise exception 'liga desconocida: %', p_league;
  end if;

  for r in select * from jsonb_array_elements(rows)
  loop
    v_team_id := null;
    if coalesce(r->>'team','') <> '' then
      insert into teams(name) values (r->>'team')
      on conflict (name) do update set name = excluded.name
      returning id into v_team_id;
    end if;

    insert into players(full_name, nationality, birth_date, position, position_group, team_id, photo_url, height_cm, contract_until, fbref_id)
    values (
      r->>'full_name',
      coalesce(r->>'nationality',''),
      nullif(r->>'birth_date','')::date,
      r->>'position',
      r->>'position_group',
      v_team_id,
      nullif(r->>'photo_url',''),
      nullif(r->>'height_cm','')::int,
      nullif(r->>'contract_until','')::date,
      nullif(r->>'fbref_id','')
    )
    on conflict (full_name, nationality) do update set
      birth_date = coalesce(excluded.birth_date, players.birth_date),
      position = coalesce(excluded.position, players.position),
      position_group = coalesce(excluded.position_group, players.position_group),
      team_id = coalesce(excluded.team_id, players.team_id),
      photo_url = coalesce(excluded.photo_url, players.photo_url),
      height_cm = coalesce(excluded.height_cm, players.height_cm),
      contract_until = coalesce(excluded.contract_until, players.contract_until),
      fbref_id = coalesce(excluded.fbref_id, players.fbref_id),
      updated_at = now()
    returning id into v_player_id;

    insert into player_season_stats(
      player_id, season, league_id, team_id, matches_played, starts, minutes_played,
      nineties, goals, assists, yellow_cards, red_cards, stats
    )
    values (
      v_player_id,
      p_season,
      p_league,
      v_team_id,
      nullif(r->>'matches_played','')::int,
      nullif(r->>'starts','')::int,
      nullif(r->>'minutes_played','')::int,
      nullif(r->>'nineties','')::numeric,
      nullif(r->>'goals','')::int,
      nullif(r->>'assists','')::int,
      nullif(r->>'yellow_cards','')::int,
      nullif(r->>'red_cards','')::int,
      coalesce(r->'stats', '{}'::jsonb)
    )
    on conflict (player_id, season, league_id) do update set
      team_id = excluded.team_id,
      matches_played = excluded.matches_played,
      starts = excluded.starts,
      minutes_played = excluded.minutes_played,
      nineties = excluded.nineties,
      goals = excluded.goals,
      assists = excluded.assists,
      yellow_cards = excluded.yellow_cards,
      red_cards = excluded.red_cards,
      stats = excluded.stats,
      updated_at = now();

    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object('inserted', inserted_count);
end;
$function$;

-- 3. Historial de lesiones -------------------------------------------------------
-- Datos de salud (sensibles según la Ley 25.326): RLS activado y SIN política de
-- lectura pública. Se leen y escriben solo con las RPC de abajo, que piden el
-- código de acceso.
create table if not exists public.player_injuries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  injury_date date not null,
  expected_return_date date,
  return_date date,
  injury_type text not null check (injury_type in ('Muscular', 'Ligamentaria', 'Tendinosa', 'Ósea', 'Articular', 'Conmoción', 'Otra')),
  body_part text not null,
  body_side text check (body_side in ('Izquierdo', 'Derecho', 'Ambos')),
  occurred_in text not null default 'Otro' check (occurred_in in ('Partido', 'Entrenamiento', 'Otro')),
  is_recurrence boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_injuries_dates_check check (return_date is null or return_date >= injury_date),
  constraint player_injuries_player_date_part_key unique (player_id, injury_date, body_part)
);

create index if not exists player_injuries_player_idx on public.player_injuries (player_id, injury_date desc);

alter table public.player_injuries enable row level security;
revoke all on public.player_injuries from anon, authenticated;

-- Carga masiva: busca al jugador por nombre (y nacionalidad si viene). No crea
-- jugadores nuevos: los nombres que no encuentra vuelven en `not_found`.
-- Si no se indica, la recidiva se calcula: misma zona y lado en menos de 2 años.
create or replace function public.admin_import_injuries(passcode text, rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r jsonb;
  v_player_id uuid;
  v_date date;
  v_side text;
  inserted_count int := 0;
  not_found jsonb := '[]'::jsonb;
begin
  if not check_admin_passcode(passcode) then
    raise exception 'invalid passcode';
  end if;

  for r in select * from jsonb_array_elements(rows)
  loop
    v_player_id := null;
    select id into v_player_id from players
    where full_name = r->>'full_name' and nationality = coalesce(r->>'nationality', '')
    limit 1;
    if v_player_id is null then
      select id into v_player_id from players where full_name = r->>'full_name' limit 1;
    end if;
    if v_player_id is null then
      not_found := not_found || to_jsonb(r->>'full_name');
      continue;
    end if;

    v_date := (r->>'injury_date')::date;
    v_side := nullif(r->>'body_side', '');

    insert into player_injuries(
      player_id, injury_date, expected_return_date, return_date, injury_type,
      body_part, body_side, occurred_in, is_recurrence, notes
    )
    values (
      v_player_id,
      v_date,
      nullif(r->>'expected_return_date', '')::date,
      nullif(r->>'return_date', '')::date,
      r->>'injury_type',
      r->>'body_part',
      v_side,
      coalesce(nullif(r->>'occurred_in', ''), 'Otro'),
      coalesce(
        nullif(r->>'is_recurrence', '')::boolean,
        exists (
          select 1 from player_injuries prev
          where prev.player_id = v_player_id
            and prev.body_part = r->>'body_part'
            and prev.body_side is not distinct from v_side
            and prev.injury_date < v_date
            and prev.injury_date >= v_date - 730
        )
      ),
      nullif(r->>'notes', '')
    )
    on conflict (player_id, injury_date, body_part) do update set
      expected_return_date = excluded.expected_return_date,
      return_date = excluded.return_date,
      injury_type = excluded.injury_type,
      body_side = excluded.body_side,
      occurred_in = excluded.occurred_in,
      is_recurrence = excluded.is_recurrence,
      notes = excluded.notes,
      updated_at = now();

    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object('inserted', inserted_count, 'not_found', not_found);
end;
$function$;

create or replace function public.get_player_injuries(passcode text, p_player_id uuid)
returns setof public.player_injuries
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if not check_admin_passcode(passcode) then
    raise exception 'invalid passcode';
  end if;
  return query
    select * from player_injuries where player_id = p_player_id order by injury_date desc;
end;
$function$;
