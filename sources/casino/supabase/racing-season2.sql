-- TrackMerdia : socle de la saison 2 (campagne verrouillée côté serveur pour les admins jusqu'au lancement).
-- Migration additive, à appliquer à la main. Suppose que public.is_admin(uid uuid default auth.uid()) existe.

-- ---------- Saisons ----------
create table if not exists public.racing_seasons (
  id text primary key,
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  published boolean not null default false
);
alter table public.racing_seasons enable row level security;
drop policy if exists racing_seasons_select on public.racing_seasons;
create policy racing_seasons_select on public.racing_seasons for select to anon, authenticated using (true);

-- Une saison est visible si elle est publiée ou si sa date de début est passée
create or replace function public.season_live(p_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.published or (s.starts_at is not null and now() >= s.starts_at)
                     from public.racing_seasons s where s.id = p_id), false);
$$;

-- ---------- Campagne ----------
create table if not exists public.racing_campaign (
  map_id text primary key,
  season_id text references public.racing_seasons (id),
  ord int,
  name text,
  data jsonb,
  author_ms int,
  starts_at timestamptz  -- null = disponible dès l'ouverture de la saison ; sinon déblocage quotidien
);
create index if not exists racing_campaign_season on public.racing_campaign (season_id, ord);
alter table public.racing_campaign enable row level security;
drop policy if exists racing_campaign_select on public.racing_campaign;
create policy racing_campaign_select on public.racing_campaign for select to anon, authenticated
  using ((public.season_live(season_id) and now() >= coalesce(starts_at, '-infinity'::timestamptz)) or public.is_admin());
-- Aucune policy d'écriture : tout passe par les RPC admin ci-dessous.

-- ---------- Records de test (temps admin avant lancement) ----------
create table if not exists public.racing_records_test (like public.racing_records including defaults including constraints);
create index if not exists racing_records_test_rank on public.racing_records_test (map_id, time_ms);
alter table public.racing_records_test enable row level security;  -- sans policy : accès service_role uniquement

-- ---------- RPC admin ----------
create or replace function public.admin_campaign_upsert(
  p_map_id text, p_season_id text, p_ord int, p_name text, p_data jsonb, p_author_ms int, p_starts_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'interdit'; end if;
  if p_map_id is null or length(p_map_id) not between 1 and 40 then raise exception 'map_id invalide'; end if;
  if p_data is null or jsonb_typeof(p_data -> 'tiles') <> 'array' or pg_column_size(p_data) > 200000 then
    raise exception 'données de map invalides';
  end if;
  insert into public.racing_campaign (map_id, season_id, ord, name, data, author_ms, starts_at)
  values (p_map_id, p_season_id, p_ord, p_name, p_data, p_author_ms, p_starts_at)
  on conflict (map_id) do update
    set season_id = excluded.season_id, ord = excluded.ord, name = excluded.name,
        data = excluded.data, author_ms = excluded.author_ms, starts_at = excluded.starts_at;
end $$;

create or replace function public.admin_campaign_delete(p_map_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'interdit'; end if;
  delete from public.racing_campaign where map_id = p_map_id;
end $$;

create or replace function public.admin_publish_season(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'interdit'; end if;
  update public.racing_seasons set published = true where id = p_id;
end $$;

-- ---------- Lecture de la campagne (la RLS filtre ce qui est visible) ----------
create or replace function public.racing_campaign_list(p_season text)
returns table(map_id text, ord int, name text, data jsonb, author_ms int)
language sql stable security invoker set search_path = '' as $$
  select c.map_id, c.ord, c.name, c.data, c.author_ms
  from public.racing_campaign c where c.season_id = p_season order by c.ord, c.map_id;
$$;

-- ---------- Droits ----------
revoke execute on function public.admin_campaign_upsert(text, text, int, text, jsonb, int, timestamptz) from public, anon;
revoke execute on function public.admin_campaign_delete(text) from public, anon;
revoke execute on function public.admin_publish_season(text) from public, anon;
grant execute on function public.admin_campaign_upsert(text, text, int, text, jsonb, int, timestamptz) to authenticated;
grant execute on function public.admin_campaign_delete(text) to authenticated;
grant execute on function public.admin_publish_season(text) to authenticated;
grant execute on function public.racing_campaign_list(text) to anon, authenticated;
grant execute on function public.season_live(text) to anon, authenticated;

-- ---------- Saison 2 (verrouillée) ----------
insert into public.racing_seasons (id, name, published, starts_at)
values ('s2', 'Saison 2', false, null)
on conflict (id) do nothing;
