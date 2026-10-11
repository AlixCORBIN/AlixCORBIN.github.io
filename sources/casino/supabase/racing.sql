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
