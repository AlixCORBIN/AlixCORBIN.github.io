-- Stats du UNO 3D (projet Supabase portfolio-counter). Migration additive : rien n'est supprimé.
-- Même principe que le loup-garou : RLS sans policy, accès uniquement via les RPC SECURITY DEFINER.

create table if not exists public.uno_games (
  game_id uuid primary key,
  players integer not null,
  bots integer not null default 0,
  rounds integer not null default 1,
  duration_s integer not null default 0,
  turns integer not null default 0,
  specials integer not null default 0,
  draws integer not null default 0,
  challenges integer not null default 0,
  catches integer not null default 0,
  target integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.uno_players (
  game_id uuid not null references public.uno_games(game_id) on delete cascade,
  seat smallint not null,
  pseudo text not null,
  is_bot boolean not null default false,
  won boolean not null default false,
  score integer not null default 0,
  cards_left integer not null default 0,
  primary key (game_id, seat)
);

alter table public.uno_games enable row level security;
alter table public.uno_players enable row level security;

-- Appelé une seule fois par l'hôte en fin de partie. Valeurs hors bornes : partie ignorée silencieusement.
create or replace function public.save_uno_game(
  p_id uuid, p_rounds integer, p_duration integer, p_turns integer, p_specials integer,
  p_draws integer, p_challenges integer, p_catches integer, p_target integer, p_players jsonb
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n int; b int; w int;
begin
  if p_id is null or p_players is null or jsonb_typeof(p_players) <> 'array' then return; end if;
  n := jsonb_array_length(p_players);
  if n not between 2 and 10
     or p_rounds not between 1 and 100
     or p_turns not between 0 and 5000
     or p_specials not between 0 and 5000
     or p_draws not between 0 and 5000
     or p_challenges not between 0 and 1000
     or p_catches not between 0 and 1000
     or p_target not in (0, 200, 500) then return; end if;
  select count(*) filter (where (x->>'bot')::boolean), count(*) filter (where (x->>'won')::boolean)
    into b, w from jsonb_array_elements(p_players) x;
  if b >= n or w <> 1 then return; end if; -- au moins un humain, exactement un vainqueur
  insert into uno_games (game_id, players, bots, rounds, duration_s, turns, specials, draws, challenges, catches, target)
  values (p_id, n, b, p_rounds, least(greatest(coalesce(p_duration, 0), 0), 86400),
          p_turns, p_specials, p_draws, p_challenges, p_catches, p_target)
  on conflict (game_id) do nothing;
  if not found then return; end if;
  insert into uno_players (game_id, seat, pseudo, is_bot, won, score, cards_left)
  select p_id, (ord - 1)::smallint,
    left(coalesce(nullif(trim(x->>'pseudo'), ''), 'Joueur'), 20),
    coalesce((x->>'bot')::boolean, false),
    coalesce((x->>'won')::boolean, false),
    least(greatest(coalesce((x->>'score')::int, 0), 0), 100000),
    least(greatest(coalesce((x->>'cards_left')::int, 0), 0), 200)
  from jsonb_array_elements(p_players) with ordinality as t(x, ord);
end $function$;

create or replace function public.get_uno_leaderboard()
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int as wins, count(*)::int as games,
      to_char(max(g.created_at), 'DD/MM/YYYY') as date
    from uno_players p join uno_games g using (game_id)
    where not p.is_bot
    group by p.pseudo
    order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$function$;

revoke all on function public.save_uno_game(uuid, integer, integer, integer, integer, integer, integer, integer, integer, jsonb) from public;
revoke all on function public.get_uno_leaderboard() from public;
grant execute on function public.save_uno_game(uuid, integer, integer, integer, integer, integer, integer, integer, integer, jsonb) to anon, authenticated, service_role;
grant execute on function public.get_uno_leaderboard() to anon, authenticated, service_role;

-- Résumé global : la fonction existante, à l'identique, avec les clés un_* en plus.
create or replace function public.get_stats_summary()
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE result JSON;
BEGIN
    SELECT json_build_object(
        'total_visits',   (SELECT COALESCE(count, 0) FROM page_views WHERE id = 1),
        'today_visits',   (SELECT COALESCE(count, 0) FROM daily_visits WHERE date = CURRENT_DATE),
        'week_visits',    (SELECT COALESCE(SUM(count), 0) FROM daily_visits WHERE date >= CURRENT_DATE - INTERVAL '7 days'),
        'month_visits',   (SELECT COALESCE(SUM(count), 0) FROM daily_visits WHERE date >= CURRENT_DATE - INTERVAL '30 days'),
        'daily_chart',    (SELECT COALESCE(json_agg(json_build_object('date', date::text, 'count', count) ORDER BY date), '[]'::json) FROM daily_visits WHERE date >= CURRENT_DATE - INTERVAL '7 days'),
        'channel_clicks', (SELECT COALESCE(json_agg(json_build_object('channel', channel_name, 'count', total) ORDER BY total DESC), '[]'::json) FROM (SELECT channel_name, SUM(count)::bigint AS total FROM channel_clicks GROUP BY channel_name) t),
        'preferences',    (SELECT COALESCE(json_agg(json_build_object('event', event_type, 'count', total)), '[]'::json) FROM (SELECT event_type, SUM(count)::bigint AS total FROM preference_events GROUP BY event_type) t),
        'bj_sessions',    (SELECT COUNT(*) FROM blackjack_sessions),
        'bj_avg_net',     (SELECT COALESCE(ROUND(AVG(net_result)::numeric, 0), 0) FROM blackjack_sessions),
        'bj_best',        (SELECT COALESCE(MAX(net_result), 0) FROM blackjack_sessions),
        'bj_worst',       (SELECT COALESCE(MIN(net_result), 0) FROM blackjack_sessions),
        'bj_max_drawdown',(SELECT COALESCE(MAX(max_drawdown), 0) FROM blackjack_sessions),
        'bj_peak',        (SELECT COALESCE(MAX(peak_bankroll), 0) FROM blackjack_sessions),
        'bj_total_credit',(SELECT COALESCE(SUM(credit_taken), 0) FROM blackjack_sessions),
        'bj_total_hands', (SELECT COALESCE(SUM(hands_played), 0) FROM blackjack_sessions),
        'bj_total_bj',    (SELECT COALESCE(SUM(blackjacks_hit), 0) FROM blackjack_sessions),
        'ro_sessions',    (SELECT COUNT(*) FROM roulette_sessions),
        'ro_spins',       (SELECT COALESCE(SUM(hits), 0) FROM roulette_numbers),
        'ro_wagered',     (SELECT COALESCE(SUM(total_wagered), 0) FROM roulette_sessions),
        'ro_avg_net',     (SELECT COALESCE(ROUND(AVG(net_result)::numeric, 0), 0) FROM roulette_sessions),
        'ro_best',        (SELECT COALESCE(MAX(net_result), 0) FROM roulette_sessions),
        'ro_red',         (SELECT COALESCE(SUM(hits), 0) FROM roulette_numbers WHERE num IN (1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36)),
        'ro_black',       (SELECT COALESCE(SUM(hits), 0) FROM roulette_numbers WHERE num > 0 AND num NOT IN (1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36)),
        'ro_zero',        (SELECT COALESCE(hits, 0) FROM roulette_numbers WHERE num = 0),
        'ro_numbers',     (SELECT json_agg(hits ORDER BY num) FROM roulette_numbers),
        'mo_games',       (SELECT COUNT(*) FROM monopoly_games),
        'mo_turns',       (SELECT COALESCE(SUM(rounds), 0) FROM monopoly_games),
        'mo_players',     (SELECT COALESCE(SUM(players - bots), 0) FROM monopoly_games WHERE players - bots >= 2),
        'mo_bots',        (SELECT COUNT(*) FROM monopoly_games WHERE bots > 0),
        'mo_props',       (SELECT COALESCE(SUM(properties_bought), 0) FROM monopoly_games),
        'mo_hotels',      (SELECT COALESCE(SUM(hotels_built), 0) FROM monopoly_games),
        'mo_trades',      (SELECT COALESCE(SUM(trades), 0) FROM monopoly_games),
        'mo_bankrupt',    (SELECT COALESCE(SUM(bankruptcies), 0) FROM monopoly_games),
        'ww_games',       (SELECT COUNT(*) FROM werewolf_games),
        'ww_players',     (SELECT COUNT(*) FROM werewolf_players WHERE NOT is_bot),
        'ww_nights',      (SELECT COALESCE(SUM(nights), 0) FROM werewolf_games),
        'ww_village',     (SELECT COUNT(*) FROM werewolf_games WHERE winner_camp = 'village'),
        'ww_wolves',      (SELECT COUNT(*) FROM werewolf_games WHERE winner_camp = 'wolves'),
        'ww_votes',       (SELECT COALESCE(SUM(eliminated_by_vote), 0) FROM werewolf_games),
        'ww_kills',       (SELECT COALESCE(SUM(killed_at_night), 0) FROM werewolf_games),
        'ww_avg_minutes', (SELECT COALESCE(ROUND(AVG(duration_s) / 60.0), 0) FROM werewolf_games),
        'un_games',       (SELECT COUNT(*) FROM uno_games),
        'un_players',     (SELECT COUNT(*) FROM uno_players WHERE NOT is_bot),
        'un_rounds',      (SELECT COALESCE(SUM(rounds), 0) FROM uno_games),
        'un_turns',       (SELECT COALESCE(SUM(turns), 0) FROM uno_games),
        'un_specials',    (SELECT COALESCE(SUM(specials), 0) FROM uno_games),
        'un_challenges',  (SELECT COALESCE(SUM(challenges), 0) FROM uno_games),
        'un_catches',     (SELECT COALESCE(SUM(catches), 0) FROM uno_games),
        'un_avg_minutes', (SELECT COALESCE(ROUND(AVG(duration_s) / 60.0), 0) FROM uno_games)
    ) INTO result;
    RETURN result;
END; $function$;
