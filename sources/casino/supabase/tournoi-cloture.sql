-- Tournoi : calendrier, sauvegarde à la clôture, effacement des données Discord.
-- Dates toujours en fuseau Europe/Paris (changement d'heure dans la nuit du 24 au 25/10/2026).

create extension if not exists pg_cron with schema pg_catalog;

-- Tables dont dépend cette partie (no-op si elles existent déjà)
create table if not exists public.tournaments (
  id        text primary key,
  name      text,
  starts_at timestamptz,
  ends_at   timestamptz
);
alter table public.tournaments enable row level security;
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select to anon, authenticated using (true);

create table if not exists public.tournament_discord (
  user_id             uuid primary key,
  discord_id          text,
  discord_name        text,
  discord_created_at  timestamptz,
  discord_avatar      text
);
alter table public.tournament_discord enable row level security;

create table if not exists public.tournament_conflicts (
  id         bigserial primary key,
  user_id    uuid,
  data       jsonb,
  created_at timestamptz default now()
);
alter table public.tournament_conflicts enable row level security;

-- Calendrier
update public.racing_seasons set starts_at = '2026-10-19 00:01 Europe/Paris'::timestamptz where id = 's2';

insert into public.tournaments (id, name, starts_at, ends_at)
values ('t1', 'Tournoi TrackMerdia saison 2 + Casino',
        '2026-10-19 00:01 Europe/Paris'::timestamptz, '2026-10-25 23:59 Europe/Paris'::timestamptz)
on conflict (id) do update set starts_at = excluded.starts_at, ends_at = excluded.ends_at;

-- Avant l'ouverture : essais admin sur la campagne s2 -> quarantaine puis suppression
insert into public.cheat_quarantine (src, data, reason)
select 'racing_records', to_jsonb(r), 'essai admin avant ouverture saison 2'
from public.racing_records r
where r.map_id in (select map_id from public.racing_campaign where season_id = 's2');

delete from public.racing_records
where map_id in (select map_id from public.racing_campaign where season_id = 's2');

-- Sauvegarde (admin seulement : RLS sans policy)
create table if not exists public.tournament_save (
  id       bigserial primary key,
  saved_at timestamptz not null default now(),
  kind     text not null,
  data     jsonb not null
);
alter table public.tournament_save enable row level security;
revoke all on public.tournament_save from anon, authenticated;

create or replace function public.tournament_save_now()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare n_racing int; n_casino int;
begin
  -- session_user : dans une fonction security definer, current_user vaudrait toujours le propriétaire
  if not (public.is_admin() or session_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'interdit';
  end if;

  insert into public.tournament_save (kind, data)
  select 'racing',
         jsonb_strip_nulls(jsonb_build_object(
           'map_id', r.map_id, 'pseudo', r.pseudo, 'time_ms', r.time_ms, 'updated_at', r.updated_at,
           'user_id', w.user_id, 'discord_name', d.discord_name, 'discord_id', d.discord_id))
  from public.racing_records r
  left join lateral (select x.user_id from public.wallets x where lower(x.pseudo) = lower(r.pseudo) limit 1) w on true
  left join public.tournament_discord d on d.user_id = w.user_id
  where r.map_id in (select map_id from public.racing_campaign where season_id = 's2');
  get diagnostics n_racing = row_count;

  insert into public.tournament_save (kind, data)
  select 'casino',
         jsonb_strip_nulls(jsonb_build_object(
           'user_id', w.user_id, 'pseudo', w.pseudo, 'bankroll', w.bankroll, 'debt', w.debt,
           'net', w.bankroll - w.debt, 'banned', w.banned, 'updated_at', w.updated_at,
           'discord_name', d.discord_name, 'discord_id', d.discord_id))
  from public.wallets w
  left join public.tournament_discord d on d.user_id = w.user_id;
  get diagnostics n_casino = row_count;

  return jsonb_build_object('racing', n_racing, 'casino', n_casino);
end $$;

revoke all on function public.tournament_save_now() from public, anon;
grant execute on function public.tournament_save_now() to authenticated, service_role;

-- Effacement Discord (appelé uniquement par pg_cron)
create or replace function public.tournament_purge_discord()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user not in ('postgres', 'supabase_admin') then raise exception 'interdit'; end if;
  update public.tournament_discord
     set discord_id = 'purged-' || user_id, discord_created_at = null, discord_avatar = null;
  delete from public.tournament_conflicts;
  update public.tournament_save set data = data - 'discord_id' where data ? 'discord_id';
end $$;

revoke all on function public.tournament_purge_discord() from public, anon, authenticated;

-- Jobs uniques (cron n'a pas d'année : chacun se désactive après exécution)
-- 25/10 23:59 Paris (CET, UTC+1) = 22:59 UTC
select cron.unschedule(jobid) from cron.job where jobname in ('tournoi-sauvegarde', 'tournoi-purge-discord');

select cron.schedule('tournoi-sauvegarde', '59 22 25 10 *',
  $$ select public.tournament_save_now(); select cron.unschedule('tournoi-sauvegarde'); $$);

-- 24/11 00:01 Paris = 23/11 23:01 UTC
select cron.schedule('tournoi-purge-discord', '1 23 23 11 *',
  $$ select public.tournament_purge_discord(); select cron.unschedule('tournoi-purge-discord'); $$);
