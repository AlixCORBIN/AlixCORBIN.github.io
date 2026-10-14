-- Classement des pilotes par saison : "s1" (25 maps officielles), "s2" (campagne saison 2), "all" (les deux).
-- Les maps de la communauté ne comptent jamais. get_racing_leaderboard (onglet Statistiques) garde le classement général.
drop function if exists public.racing_podium(integer);
create or replace function public.racing_podium(p_limit integer default 50, p_scope text default 'all')
returns table(pseudo text, p1 bigint, p2 bigint, p3 bigint, top10 bigint, maps bigint, last_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with m as (
    select map_id from racing_records
     where map_id like 'v2-%' and p_scope in ('s1', 'all')
    union
    select c.map_id from racing_campaign c
     where c.season_id = 's2' and season_live('s2') and p_scope in ('s2', 'all')),
  r as (
    select pseudo, map_id, updated_at, rank() over (partition by map_id order by time_ms) rk
    from racing_records where map_id in (select map_id from m) and not racing_banned(pseudo))
  select min(pseudo), count(*) filter (where rk = 1), count(*) filter (where rk = 2), count(*) filter (where rk = 3),
         count(*) filter (where rk <= 10), count(*), max(updated_at)
  from r group by lower(pseudo)
  order by 2 desc, 3 desc, 4 desc, 5 desc, 6 desc, 7
  limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.racing_podium(integer, text) to anon, authenticated;
