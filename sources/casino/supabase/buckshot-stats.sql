-- Stats du Buckshot (projet Supabase portfolio-counter). Migration additive : rien n'est supprimé.
-- RLS sans policy, accès uniquement via les RPC SECURITY DEFINER. Résumé dans sa propre fonction
-- (get_buckshot_summary) pour ne pas toucher à get_stats_summary.

create table if not exists public.buckshot_games (
  game_id uuid primary key,
  players integer not null,
  bots integer not null default 0,
  rounds integer not null default 1,
  duration_s integer not null default 0,
  loads integer not null default 0,
  shots integer not null default 0,
  hits integer not null default 0,
  self_blanks integer not null default 0,
  items integer not null default 0,
  damage integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.buckshot_players (
  game_id uuid not null references public.buckshot_games(game_id) on delete cascade,
  seat smallint not null,
  pseudo text not null,
  is_bot boolean not null default false,
  won boolean not null default false,
  rounds_won integer not null default 0,
  primary key (game_id, seat)
);

alter table public.buckshot_games enable row level security;
alter table public.buckshot_players enable row level security;

create or replace function public.save_buckshot_game(
  p_id uuid, p_rounds integer, p_duration integer, p_loads integer, p_shots integer, p_hits integer,
  p_self_blanks integer, p_items integer, p_damage integer, p_players jsonb
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n int; b int; w int;
begin
  if p_id is null or p_players is null or jsonb_typeof(p_players) <> 'array' then return; end if;
  n := jsonb_array_length(p_players);
  if n not between 2 and 4
     or p_rounds not between 1 and 3
     or p_loads not between 1 and 500
     or p_shots not between 1 and 3000
     or p_hits not between 0 and p_shots
     or p_self_blanks not between 0 and p_shots
     or p_items not between 0 and 3000
     or p_damage not between 0 and 1000 then return; end if;
  select count(*) filter (where (x->>'bot')::boolean), count(*) filter (where (x->>'won')::boolean)
    into b, w from jsonb_array_elements(p_players) x;
  if b >= n or w <> 1 then return; end if;
  insert into buckshot_games (game_id, players, bots, rounds, duration_s, loads, shots, hits, self_blanks, items, damage)
  values (p_id, n, b, p_rounds, least(greatest(coalesce(p_duration, 0), 0), 86400),
          p_loads, p_shots, p_hits, p_self_blanks, p_items, p_damage)
  on conflict (game_id) do nothing;
  if not found then return; end if;
  insert into buckshot_players (game_id, seat, pseudo, is_bot, won, rounds_won)
  select p_id, (ord - 1)::smallint,
    left(coalesce(nullif(trim(x->>'pseudo'), ''), 'Joueur'), 20),
    coalesce((x->>'bot')::boolean, false),
    coalesce((x->>'won')::boolean, false),
    least(greatest(coalesce((x->>'rounds_won')::int, 0), 0), 3)
  from jsonb_array_elements(p_players) with ordinality as t(x, ord);
end $function$;

create or replace function public.get_buckshot_leaderboard()
returns json language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int as wins, count(*)::int as games,
      to_char(max(g.created_at), 'DD/MM/YYYY') as date
    from buckshot_players p join buckshot_games g using (game_id)
    where not p.is_bot
    group by p.pseudo
    order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$function$;

create or replace function public.get_buckshot_summary()
returns json language sql stable security definer set search_path to 'public'
as $function$
  select json_build_object(
    'games',       (select count(*) from buckshot_games),
    'players',     (select count(*) from buckshot_players where not is_bot),
    'rounds',      (select coalesce(sum(rounds), 0) from buckshot_games),
    'shots',       (select coalesce(sum(shots), 0) from buckshot_games),
    'hits',        (select coalesce(sum(hits), 0) from buckshot_games),
    'self_blanks', (select coalesce(sum(self_blanks), 0) from buckshot_games),
    'items',       (select coalesce(sum(items), 0) from buckshot_games),
    'bot_wins',    (select count(*) from buckshot_players where is_bot and won),
    'avg_minutes', (select coalesce(round(avg(duration_s) / 60.0), 0) from buckshot_games)
  );
$function$;

revoke all on function public.save_buckshot_game(uuid, integer, integer, integer, integer, integer, integer, integer, integer, jsonb) from public;
revoke all on function public.get_buckshot_leaderboard() from public;
revoke all on function public.get_buckshot_summary() from public;
grant execute on function public.save_buckshot_game(uuid, integer, integer, integer, integer, integer, integer, integer, integer, jsonb) to anon, authenticated, service_role;
grant execute on function public.get_buckshot_leaderboard() to anon, authenticated, service_role;
grant execute on function public.get_buckshot_summary() to anon, authenticated, service_role;
