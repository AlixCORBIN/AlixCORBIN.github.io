-- TrackMerdia saison 2 : anti-triche des fantômes pour les maps de campagne. Migration à appliquer à la main,
-- APRÈS racing-season2.sql. Ne change rien pour la saison 1 (maps officielles, communautaires) :
--   * racing_ghost_problem n'est pas réécrite à partir du dépôt (la version en base a des seuils différents) :
--     on relit sa définition actuelle (pg_get_functiondef) et on y injecte seulement les ajouts saison 2.
--     Si un des points d'ancrage attendus n'est pas trouvé exactement une fois, la migration échoue sans rien changer.
--   * Les ajouts ne s'appliquent que si la meta vient de racing_campaign avec meta.v = 2.

-- ---------- Repères des maps de campagne (calculés par trackMeta() de src/games/racing/meta.js) ----------
alter table public.racing_campaign add column if not exists meta jsonb;

-- racing_records_test : clé (map, pseudo) comme racing_records (« like … including constraints » ne copie pas la clé primaire)
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.racing_records_test'::regclass and contype = 'p') then
    alter table public.racing_records_test add primary key (map_id, pseudo);
  end if;
end $$;

-- ---------- admin_campaign_upsert : reçoit aussi la meta ----------
drop function if exists public.admin_campaign_upsert(text, text, int, text, jsonb, int, timestamptz);
create or replace function public.admin_campaign_upsert(
  p_map_id text, p_season_id text, p_ord int, p_name text, p_data jsonb, p_author_ms int, p_starts_at timestamptz, p_meta jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'interdit'; end if;
  if p_map_id is null or length(p_map_id) not between 1 and 40 then raise exception 'map_id invalide'; end if;
  if p_data is null or coalesce(jsonb_typeof(p_data -> 'tiles'), '') <> 'array' or pg_column_size(p_data) > 200000 then
    raise exception 'données de map invalides';
  end if;
  if p_meta is null or coalesce(jsonb_typeof(p_meta -> 'line'), '') <> 'array' or coalesce(jsonb_typeof(p_meta -> 'finish'), '') <> 'array'
     or coalesce(jsonb_typeof(p_meta -> 'cps'), '') <> 'array' or coalesce(jsonb_typeof(p_meta -> 'start'), '') <> 'array'
     or pg_column_size(p_meta) > 200000 then
    raise exception 'repères (meta) invalides';
  end if;
  insert into public.racing_campaign (map_id, season_id, ord, name, data, author_ms, starts_at, meta)
  values (p_map_id, p_season_id, p_ord, p_name, p_data, p_author_ms, p_starts_at, p_meta)
  on conflict (map_id) do update
    set season_id = excluded.season_id, ord = excluded.ord, name = excluded.name, data = excluded.data,
        author_ms = excluded.author_ms, starts_at = excluded.starts_at, meta = excluded.meta;
end $$;
revoke execute on function public.admin_campaign_upsert(text, text, int, text, jsonb, int, timestamptz, jsonb) from public, anon;
grant execute on function public.admin_campaign_upsert(text, text, int, text, jsonb, int, timestamptz, jsonb) to authenticated;

-- ---------- racing_ghost_problem : meta de campagne, téléporteurs, rails, vitesse max saison 2 ----------
-- Ajouts (uniquement si meta.v = 2) :
--   1. meta lue dans racing_official, sinon dans racing_campaign ;
--   2. un saut > seuil est accepté s'il arrive à moins de 12 u d'une sortie de téléporteur ou d'une extrémité de rail
--      (même logique que pour les checkpoints / le départ) ;
--   3. seuil de vitesse entre deux points : 6,0 u / 50 ms (120 u/s) au lieu de celui de la saison 1, car le turbo
--      niveau 3 atteint 5,6 u / 50 ms (112 u/s) en série (mesuré par tools/ghost-check-s2.mjs).
--   Hors piste, départ, arrivée et checkpoints : seuils inchangés (aucun refus constaté sur les brouillons et pistes de test).
do $mig$
declare
  def text;
  n int;
begin
  select pg_get_functiondef('public.racing_ghost_problem(text, integer, jsonb)'::regprocedure) into def;
  if def ~ 's2 boolean' then raise notice 'racing_ghost_problem contient déjà les ajouts saison 2'; return; end if;

  n := regexp_count(def, '\mdeclare\M', 1, 'i');
  if n < 1 then raise exception 'ancrage « declare » introuvable'; end if;
  def := regexp_replace(def, '\mdeclare\M', E'declare\n  s2 boolean := false; tx float8[]; ty float8[]; tz float8[];', 'i');

  n := regexp_count(def, 'select\s+o\.meta\s+into\s+meta\s+from\s+racing_official\s+o\s+where\s+o\.map_id\s*=\s*p_map\s*;', 1, 'i');
  if n <> 1 then raise exception 'ancrage « select o.meta into meta » trouvé % fois', n; end if;
  def := regexp_replace(def, '(select\s+o\.meta\s+into\s+meta\s+from\s+racing_official\s+o\s+where\s+o\.map_id\s*=\s*p_map\s*;)', E'\\1
  if meta is null then select c.meta into meta from racing_campaign c where c.map_id = p_map; end if;
  if meta is not null and meta->>''v'' = ''2'' then
    s2 := true;
    select array_agg((e->>0)::float8), array_agg((e->>1)::float8), array_agg((e->>2)::float8) into tx, ty, tz
      from (select e from jsonb_array_elements(coalesce(meta->''teleports'', ''[]''::jsonb)) e
            union all select e from jsonb_array_elements(coalesce(meta->''rails'', ''[]''::jsonb)) e) s;
  end if;', 'i');

  n := regexp_count(def, 'if\s+d\s*>\s*[0-9.]+\s+then', 1, 'i');
  if n <> 1 then raise exception 'ancrage « if d > seuil then » trouvé % fois', n; end if;
  def := regexp_replace(def, 'if\s+d\s*>\s*([0-9.]+)\s+then', 'if d > (case when s2 then 6.0 else \1 end) then', 'i');

  n := regexp_count(def, 'if\s+not\s+teleport\s+then', 1, 'i');
  if n <> 1 then raise exception 'ancrage « if not teleport then » trouvé % fois', n; end if;
  def := regexp_replace(def, '(if\s+not\s+teleport\s+then)', E'if not teleport and tx is not null then
        for j in 1 .. array_length(tx, 1) loop
          if sqrt((gx[i] - tx[j])^2 + (gy[i] - ty[j])^2 + (gz[i] - tz[j])^2) < 12 then teleport := true; end if;
        end loop;
      end if;
      \\1', 'i');

  execute def;
end $mig$;

-- Lecture de la campagne (racing_campaign_list est security invoker : la RLS filtre, encore faut-il le droit select)
grant select on public.racing_seasons, public.racing_campaign to anon, authenticated;

-- La fonction racing-verify (clé service) appelle ces fonctions directement
grant execute on function public.racing_ghost_problem(text, integer, jsonb) to service_role;
grant execute on function public.season_live(text) to service_role;
grant execute on function public.is_admin(uuid) to service_role;
