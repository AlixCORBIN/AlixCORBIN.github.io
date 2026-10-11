-- Puissance 4 : stats de parties (même principe que la bataille navale)
-- Accès uniquement via les RPC (RLS activée, aucune policy).

create table if not exists public.connect4_games (
  game_id uuid primary key,
  players int not null,
  bots int not null default 0,
  bot_level smallint not null default 0,
  rounds int not null default 1,
  draws int not null default 0,
  moves int not null default 0,
  duration_s int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.connect4_players (
  game_id uuid not null references public.connect4_games (game_id) on delete cascade,
  seat smallint not null,
  pseudo text not null,
  is_bot boolean not null default false,
  won boolean not null default false,
  round_wins int not null default 0,
  moves int not null default 0,
  primary key (game_id, seat)
);

alter table public.connect4_games enable row level security;
alter table public.connect4_players enable row level security;
revoke all on public.connect4_games, public.connect4_players from anon, authenticated;

-- Envoi : une fois par l'hôte en fin de partie, doublon ignoré.
create or replace function public.save_connect4_game(
  p_id uuid, p_duration int, p_rounds int, p_draws int, p_bot_level int, p_players jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare n int; m int; w int;
begin
  if p_id is null or jsonb_typeof(p_players) <> 'array' then return; end if;
  n := jsonb_array_length(p_players);
  select coalesce(sum((x->>'moves')::int), 0), coalesce(sum((x->>'round_wins')::int), 0)
    into m, w from jsonb_array_elements(p_players) x;
  if n <> 2 or p_rounds not between 1 and 15 or p_draws not between 0 and p_rounds
     or w + p_draws <> p_rounds or m not between 7 * (p_rounds - p_draws) and 42 * p_rounds then return; end if;
  insert into connect4_games values (p_id, n,
    (select count(*) from jsonb_array_elements(p_players) x where (x->>'bot')::boolean),
    least(greatest(coalesce(p_bot_level, 0), 0), 3), p_rounds, p_draws, m,
    greatest(coalesce(p_duration, 0), 0), now())
  on conflict (game_id) do nothing;
  if not found then return; end if;
  insert into connect4_players
  select p_id, (ord - 1)::smallint, left(coalesce(nullif(trim(x->>'pseudo'), ''), 'Joueur'), 20),
    coalesce((x->>'bot')::boolean, false), coalesce((x->>'won')::boolean, false),
    coalesce((x->>'round_wins')::int, 0), coalesce((x->>'moves')::int, 0)
  from jsonb_array_elements(p_players) with ordinality t(x, ord);
end $$;

create or replace function public.get_connect4_summary()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'games', (select count(*) from connect4_games),
    'players', (select count(*) from connect4_players where not is_bot),
    'rounds', (select coalesce(sum(rounds), 0) from connect4_games),
    'avg_minutes', (select coalesce(round(avg(duration_s) / 60.0), 0) from connect4_games),
    'moves', (select coalesce(sum(moves), 0) from connect4_games),
    'draws', (select coalesce(sum(draws), 0) from connect4_games),
    'vs_bot', (select count(*) from connect4_games where bots > 0),
    'bot_wins', (select count(*) from connect4_players where is_bot and won));
$$;

create or replace function public.get_connect4_leaderboard()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int wins, count(*)::int games, to_char(max(g.created_at), 'DD/MM/YYYY') date
    from connect4_players p join connect4_games g using (game_id) where not p.is_bot
    group by p.pseudo order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$$;

grant execute on function public.save_connect4_game(uuid, int, int, int, int, jsonb),
  public.get_connect4_summary(), public.get_connect4_leaderboard() to anon, authenticated;
