-- Course 3D (TrackRush) : maps de la communauté + records par map. Migration additive.
-- RLS sans policy : tout passe par les RPC SECURITY DEFINER ci-dessous.

create table if not exists public.racing_maps (
  map_id uuid primary key default gen_random_uuid(),
  name text not null,
  author text not null,
  data jsonb not null,
  author_time integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.racing_records (
  map_id text not null,
  pseudo text not null,
  time_ms integer not null,
  ghost jsonb,
  attempts integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (map_id, pseudo)
);
create index if not exists racing_records_rank on public.racing_records (map_id, time_ms);

alter table public.racing_maps enable row level security;
alter table public.racing_records enable row level security;

-- Enregistre un temps : garde le meilleur par (map, pseudo). Retourne le rang du joueur.
create or replace function public.racing_submit(p_map text, p_pseudo text, p_time integer, p_ghost jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare r int;
begin
  p_pseudo := btrim(p_pseudo);
  if p_map is null or length(p_map) > 40 or p_pseudo is null or length(p_pseudo) not between 1 and 16
     or p_time not between 2000 and 3600000
     or (p_ghost is not null and pg_column_size(p_ghost) > 300000) then return null; end if;
  insert into racing_records as rr (map_id, pseudo, time_ms, ghost)
  values (p_map, p_pseudo, p_time, p_ghost)
  on conflict (map_id, pseudo) do update
    set attempts = rr.attempts + 1,
        time_ms = least(rr.time_ms, excluded.time_ms),
        ghost = case when excluded.time_ms < rr.time_ms then excluded.ghost else rr.ghost end,
        updated_at = case when excluded.time_ms < rr.time_ms then now() else rr.updated_at end;
  select count(*) + 1 into r from racing_records
   where map_id = p_map and time_ms < (select time_ms from racing_records where map_id = p_map and pseudo = p_pseudo);
  return r;
end $$;

create or replace function public.racing_leaderboard(p_map text, p_limit integer default 100)
returns table(rank bigint, pseudo text, time_ms integer, attempts integer, updated_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select rank() over (order by time_ms), pseudo, time_ms, attempts, updated_at
  from racing_records where map_id = p_map order by time_ms, updated_at limit least(greatest(p_limit, 1), 500);
$$;

create or replace function public.racing_ghost(p_map text, p_pseudo text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select ghost from racing_records where map_id = p_map and pseudo = p_pseudo;
$$;

-- Record du monde + nombre de joueurs pour une liste de maps (menu).
create or replace function public.racing_wrs(p_maps text[])
returns table(map_id text, pseudo text, time_ms integer, players bigint)
language sql stable security definer set search_path to 'public' as $$
  select distinct on (r.map_id) r.map_id, r.pseudo, r.time_ms,
         count(*) over (partition by r.map_id)
  from racing_records r where r.map_id = any(p_maps)
  order by r.map_id, r.time_ms, r.updated_at;
$$;

create or replace function public.racing_publish_map(p_name text, p_author text, p_data jsonb, p_author_time integer)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare id uuid;
begin
  p_name := btrim(p_name); p_author := btrim(p_author);
  if length(p_name) not between 1 and 32 or length(p_author) not between 1 and 16
     or p_author_time not between 2000 and 3600000
     or jsonb_typeof(p_data -> 'tiles') <> 'array'
     or jsonb_array_length(p_data -> 'tiles') not between 3 and 1500
     or pg_column_size(p_data) > 200000 then return null; end if;
  insert into racing_maps (name, author, data, author_time) values (p_name, p_author, p_data, p_author_time)
  returning map_id into id;
  return id;
end $$;

create or replace function public.racing_list_maps(p_search text default '', p_limit integer default 60)
returns table(map_id uuid, name text, author text, author_time integer, created_at timestamptz, players bigint)
language sql stable security definer set search_path to 'public' as $$
  select m.map_id, m.name, m.author, m.author_time, m.created_at,
         (select count(*) from racing_records r where r.map_id = m.map_id::text)
  from racing_maps m
  where coalesce(p_search, '') = '' or m.name ilike '%' || p_search || '%' or m.author ilike '%' || p_search || '%'
  order by m.created_at desc limit least(greatest(p_limit, 1), 200);
$$;

create or replace function public.racing_get_map(p_id uuid)
returns table(map_id uuid, name text, author text, data jsonb, author_time integer)
language sql stable security definer set search_path to 'public' as $$
  select m.map_id, m.name, m.author, m.data, m.author_time from racing_maps m where m.map_id = p_id;
$$;

grant execute on function public.racing_submit, public.racing_leaderboard, public.racing_ghost, public.racing_wrs,
  public.racing_publish_map, public.racing_list_maps, public.racing_get_map to anon, authenticated;

-- ---------- Records perdus (notifications) et records d'un pilote ----------
create table if not exists public.racing_events (
  id bigserial primary key,
  map_id text not null,
  new_pseudo text not null,
  new_time integer not null,
  old_pseudo text not null,
  old_time integer not null,
  created_at timestamptz not null default now()
);
create index if not exists racing_events_old on public.racing_events (lower(old_pseudo), created_at desc);
alter table public.racing_events enable row level security;

-- racing_submit (remplace la version ci-dessus) : ajoute un événement quand le record du monde change de main
create or replace function public.racing_submit(p_map text, p_pseudo text, p_time integer, p_ghost jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare r int; wr_p text; wr_t int;
begin
  p_pseudo := btrim(p_pseudo);
  if p_map is null or length(p_map) > 40 or p_pseudo is null or length(p_pseudo) not between 1 and 16
     or p_time not between 2000 and 3600000
     or (p_ghost is not null and pg_column_size(p_ghost) > 300000) then return null; end if;
  select pseudo, time_ms into wr_p, wr_t from racing_records where map_id = p_map order by time_ms, updated_at limit 1;
  insert into racing_records as rr (map_id, pseudo, time_ms, ghost)
  values (p_map, p_pseudo, p_time, p_ghost)
  on conflict (map_id, pseudo) do update
    set attempts = rr.attempts + 1,
        time_ms = least(rr.time_ms, excluded.time_ms),
        ghost = case when excluded.time_ms < rr.time_ms then excluded.ghost else rr.ghost end,
        updated_at = case when excluded.time_ms < rr.time_ms then now() else rr.updated_at end;
  if wr_p is not null and p_time < wr_t and lower(wr_p) <> lower(p_pseudo) then
    insert into racing_events (map_id, new_pseudo, new_time, old_pseudo, old_time) values (p_map, p_pseudo, p_time, wr_p, wr_t);
  end if;
  select count(*) + 1 into r from racing_records
   where map_id = p_map and time_ms < (select time_ms from racing_records where map_id = p_map and pseudo = p_pseudo);
  return r;
end $$;

create or replace function public.racing_notifications(p_pseudo text, p_since timestamptz)
returns table(id bigint, map_id text, new_pseudo text, new_time integer, old_time integer, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select e.id, e.map_id, e.new_pseudo, e.new_time, e.old_time, e.created_at from racing_events e
  where lower(e.old_pseudo) = lower(btrim(p_pseudo)) and e.created_at > coalesce(p_since, now() - interval '30 days')
  order by e.created_at desc limit 50;
$$;

create or replace function public.racing_player_records(p_pseudo text)
returns table(map_id text, time_ms integer, rank bigint, players bigint, wr_pseudo text, wr_time integer, updated_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with ranked as (
    select r.map_id, r.pseudo, r.time_ms, r.updated_at,
           rank() over (partition by r.map_id order by r.time_ms) rk,
           count(*) over (partition by r.map_id) n,
           first_value(r.pseudo) over (partition by r.map_id order by r.time_ms, r.updated_at) wp,
           min(r.time_ms) over (partition by r.map_id) wt
    from racing_records r)
  select map_id, time_ms, rk, n, wp, wt, updated_at from ranked where lower(pseudo) = lower(btrim(p_pseudo))
  order by updated_at desc;
$$;

grant execute on function public.racing_notifications(text, timestamptz), public.racing_player_records(text) to anon, authenticated;

-- ---------- Classement des pilotes : nombre de 1res, 2es, 3es places (hors anciennes pistes off-*) ----------
create or replace function public.racing_podium(p_limit integer default 50)
returns table(pseudo text, p1 bigint, p2 bigint, p3 bigint, top10 bigint, maps bigint, last_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with r as (
    select pseudo, map_id, updated_at, rank() over (partition by map_id order by time_ms) rk
    from racing_records where map_id not like 'off-%' and map_id not like 'zz-%')
  select min(pseudo), count(*) filter (where rk = 1), count(*) filter (where rk = 2), count(*) filter (where rk = 3),
         count(*) filter (where rk <= 10), count(*), max(updated_at)
  from r group by lower(pseudo)
  order by 2 desc, 3 desc, 4 desc, 5 desc, 6 desc, 7
  limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.racing_podium(integer) to anon, authenticated;

-- Onglet Statistiques du portfolio : top 10 du classement des pilotes
create or replace function public.get_racing_leaderboard()
returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(json_build_object('pseudo', pseudo, 'wins', p1, 'p2', p2, 'p3', p3, 'top10', top10, 'games', maps,
    'date', to_char(last_at, 'DD/MM/YYYY'))), '[]'::json)
  from public.racing_podium(10);
$$;

-- ---------- Anti-triche : vérification du fantôme dans racing_submit (aucune requête en plus côté client) ----------
-- racing_official : repères des maps officielles (départ, arrivées, checkpoints, axe de la piste), remplis par
-- `node tools/racing-meta.mjs` (calculés à partir de maps.js). racing_rejected garde la trace des temps refusés.
create table if not exists public.racing_official (map_id text primary key, meta jsonb not null);
alter table public.racing_official enable row level security;
create table if not exists public.racing_rejected (
  id bigserial primary key, map_id text, pseudo text, time_ms integer, reason text, created_at timestamptz not null default now());
alter table public.racing_rejected enable row level security;

-- Retourne null si le fantôme est plausible, sinon la raison du refus (~50 ms sur la plus longue map).
-- Contrôles : durée du fantôme = temps annoncé, vitesse max entre deux points (sauf réapparition sur un checkpoint),
-- et pour les maps officielles : départ, arrivée, passage par chaque checkpoint, pas plus de 15 % du trajet loin de la piste.
create or replace function public.racing_ghost_problem(p_map text, p_time integer, g jsonb)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare
  n int; meta jsonb; i int; j int; d float; best float; off int := 0; checked int := 0; ok boolean; teleport boolean;
  gx float8[]; gy float8[]; gz float8[];
  lx float8[]; ly float8[]; lz float8[];
  cx float8[]; cy float8[]; cz float8[];
  fx float8[]; fy float8[]; fz float8[];
begin
  if g is null or jsonb_typeof(g) <> 'array' or (g->>0) is distinct from '-2' then return 'fantôme absent'; end if;
  n := (jsonb_array_length(g) - 1) / 7;
  if (jsonb_array_length(g) - 1) % 7 <> 0 or n < 10 then return 'fantôme mal formé'; end if;
  if n * 50 < p_time - 60 or n * 50 > p_time + 10 then return 'durée du fantôme ≠ temps'; end if;
  select array_agg((g->>(1 + k * 7))::float8 / 10 order by k), array_agg((g->>(2 + k * 7))::float8 / 10 order by k),
         array_agg((g->>(3 + k * 7))::float8 / 10 order by k)
    into gx, gy, gz from generate_series(0, n - 1) k;
  select o.meta into meta from racing_official o where o.map_id = p_map;
  if meta is not null then
    select array_agg((e->>0)::float8), array_agg((e->>1)::float8), array_agg((e->>2)::float8) into lx, ly, lz from jsonb_array_elements(meta->'line') e;
    select array_agg((e->>0)::float8), array_agg((e->>1)::float8), array_agg((e->>2)::float8) into cx, cy, cz
      from (select e from jsonb_array_elements(meta->'cps') e union all select meta->'start') s;
    select array_agg((e->>0)::float8), array_agg((e->>1)::float8), array_agg((e->>2)::float8) into fx, fy, fz from jsonb_array_elements(meta->'finish') e;
  end if;
  for i in 2 .. n loop
    d := sqrt((gx[i] - gx[i-1])^2 + (gy[i] - gy[i-1])^2 + (gz[i] - gz[i-1])^2);
    if d > 5.5 then
      teleport := false;
      if cx is not null then
        for j in 1 .. array_length(cx, 1) loop
          if sqrt((gx[i] - cx[j])^2 + (gy[i] - cy[j])^2 + (gz[i] - cz[j])^2) < 12 then teleport := true; end if;
        end loop;
      end if;
      if not teleport then return 'vitesse impossible'; end if;
    end if;
  end loop;
  if meta is null then return null; end if;
  i := 1;
  while i <= n loop
    best := 1e18;
    for j in 1 .. array_length(lx, 1) loop
      d := (gx[i] - lx[j])^2 + (gy[i] - ly[j])^2 + (gz[i] - lz[j])^2;
      if d < best then best := d; end if;
    end loop;
    checked := checked + 1;
    if best > 3600 then off := off + 1; end if;
    i := i + 3;
  end loop;
  if off > checked * 0.15 then return 'hors piste'; end if;
  if sqrt((gx[1] - (meta->'start'->>0)::float8)^2 + (gy[1] - (meta->'start'->>1)::float8)^2 + (gz[1] - (meta->'start'->>2)::float8)^2) > 25 then return 'mauvais départ'; end if;
  ok := false;
  for j in 1 .. array_length(fx, 1) loop
    if sqrt((gx[n] - fx[j])^2 + (gy[n] - fy[j])^2 + (gz[n] - fz[j])^2) < 30 then ok := true; end if;
  end loop;
  if not ok then return 'arrivée non atteinte'; end if;
  for j in 1 .. coalesce(array_length(cx, 1), 1) - 1 loop
    ok := false;
    for i in 1 .. n loop
      if sqrt((gx[i] - cx[j])^2 + (gy[i] - cy[j])^2 + (gz[i] - cz[j])^2) < 22 then ok := true; exit; end if;
    end loop;
    if not ok then return 'checkpoint manqué'; end if;
  end loop;
  return null;
end $$;
revoke execute on function public.racing_ghost_problem(text, integer, jsonb) from anon, authenticated, public;

-- racing_submit (version finale) : refuse et journalise les temps dont le fantôme n'est pas plausible
create or replace function public.racing_submit(p_map text, p_pseudo text, p_time integer, p_ghost jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare r int; wr_p text; wr_t int; why text;
begin
  p_pseudo := btrim(p_pseudo);
  if p_map is null or length(p_map) > 40 or p_pseudo is null or length(p_pseudo) not between 1 and 16
     or p_time not between 2000 and 3600000
     or (p_ghost is not null and pg_column_size(p_ghost) > 300000) then return null; end if;
  why := racing_ghost_problem(p_map, p_time, p_ghost);
  if why is not null then
    insert into racing_rejected (map_id, pseudo, time_ms, reason) values (p_map, p_pseudo, p_time, why);
    return null;
  end if;
  select pseudo, time_ms into wr_p, wr_t from racing_records where map_id = p_map order by time_ms, updated_at limit 1;
  insert into racing_records as rr (map_id, pseudo, time_ms, ghost)
  values (p_map, p_pseudo, p_time, p_ghost)
  on conflict (map_id, pseudo) do update
    set attempts = rr.attempts + 1,
        time_ms = least(rr.time_ms, excluded.time_ms),
        ghost = case when excluded.time_ms < rr.time_ms then excluded.ghost else rr.ghost end,
        updated_at = case when excluded.time_ms < rr.time_ms then now() else rr.updated_at end;
  if wr_p is not null and p_time < wr_t and lower(wr_p) <> lower(p_pseudo) then
    insert into racing_events (map_id, new_pseudo, new_time, old_pseudo, old_time) values (p_map, p_pseudo, p_time, wr_p, wr_t);
  end if;
  select count(*) + 1 into r from racing_records
   where map_id = p_map and time_ms < (select time_ms from racing_records where map_id = p_map and pseudo = p_pseudo);
  return r;
end $$;
