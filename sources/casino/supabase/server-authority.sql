-- Casino : le serveur fait autorité.
-- 1. Chaque navigateur a une identité (connexion anonyme automatique, liable à un compte).
-- 2. Le solde (wallets) n'est écrit que par le serveur.
-- 3. Blackjack et roulette tournent dans l'Edge Function casino-table ; l'état complet
--    (sabot, tirages à venir) reste privé, seule la vue publique est lisible.
-- 4. Autres jeux : une partie n'est enregistrée que si tous les humains envoient le même
--    résultat, et les classements ne comptent que les parties entre humains.
-- 5. TrackMerdia : les temps ne sont acceptés que via racing-verify (rejeu serveur).
-- À appliquer après anti-cheat.sql.

/* ---------- portefeuilles ---------- */
create table if not exists public.wallets (
  user_id uuid primary key references auth.users on delete cascade,
  pseudo text check (pseudo is null or char_length(pseudo) between 1 and 16),
  bankroll bigint not null default 1000 check (bankroll between 0 and 1000000000),
  debt bigint not null default 0 check (debt >= 0),
  seat text,
  seat_at timestamptz,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists wallets_pseudo_uniq on public.wallets (lower(pseudo)) where pseudo is not null;
alter table public.wallets enable row level security;
drop policy if exists "wallet: lecture perso" on public.wallets;
create policy "wallet: lecture perso" on public.wallets for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.wallets from anon, authenticated;

-- Reprise des soldes des comptes existants (sauvegarde cloud, déjà bornée par anti-cheat.sql)
insert into public.wallets (user_id, pseudo, bankroll, debt)
select s.user_id,
  nullif(left(btrim(s.data->'wallet'->>'name'), 16), ''),
  least(greatest(coalesce((s.data->'wallet'->>'bankroll')::bigint, 1000), 0), 1000000),
  greatest(coalesce((s.data->'wallet'->>'debt')::bigint, 0), 0)
from public.user_save_active s
on conflict (user_id) do nothing;
-- pseudos en double ou bannis : on les libère
update public.wallets w set pseudo = null where pseudo is not null and (public.player_banned(pseudo)
  or exists (select 1 from public.wallets o where lower(o.pseudo) = lower(w.pseudo) and o.created_at < w.created_at));

create or replace function public.wallet_me() returns json language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); w wallets;
begin
  if uid is null then raise exception 'non connecte'; end if;
  insert into wallets (user_id) values (uid) on conflict do nothing;
  select * into w from wallets where user_id = uid;
  return json_build_object('bankroll', w.bankroll, 'debt', w.debt, 'pseudo', w.pseudo, 'banned', w.banned or player_banned(w.pseudo));
end $$;

create or replace function public.wallet_set_pseudo(p text) returns json language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'non connecte'; end if;
  p := btrim(coalesce(p, ''));
  if char_length(p) not between 1 and 16 then raise exception 'pseudo invalide'; end if;
  if player_banned(p) then raise exception 'pseudo banni'; end if;
  if exists (select 1 from wallets where lower(pseudo) = lower(p) and user_id <> uid) then raise exception 'pseudo deja pris'; end if;
  insert into wallets (user_id, pseudo) values (uid, p)
  on conflict (user_id) do update set pseudo = excluded.pseudo, updated_at = now();
  return wallet_me();
end $$;

-- « Emprunter » dans le hall : remet le solde à 1000, la différence part en dette
create or replace function public.wallet_borrow() returns json language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'non connecte'; end if;
  update wallets set debt = debt + (1000 - bankroll), bankroll = 1000, updated_at = now()
   where user_id = uid and bankroll < 5 and (seat is null or seat_at < now() - interval '30 seconds');
  return wallet_me();
end $$;
revoke execute on function public.wallet_me(), public.wallet_set_pseudo(text), public.wallet_borrow() from anon, public;
grant execute on function public.wallet_me(), public.wallet_set_pseudo(text), public.wallet_borrow() to authenticated;

/* ---------- tables d'argent tenues par le serveur ---------- */
create table if not exists public.casino_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{5}$'),
  game text not null check (game in ('blackjack', 'roulette')),
  room jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.casino_rooms enable row level security; -- aucune policy : privé
revoke all on public.casino_rooms from anon, authenticated;

create table if not exists public.casino_room_views (
  code text primary key references public.casino_rooms on delete cascade,
  game text not null,
  is_public boolean not null default false,
  players int not null default 0,
  view jsonb not null,
  miis jsonb not null default '{}',
  version int not null,
  updated_at timestamptz not null default now()
);
alter table public.casino_room_views enable row level security;
drop policy if exists "vue publique" on public.casino_room_views;
create policy "vue publique" on public.casino_room_views for select to anon, authenticated using (true);
revoke insert, update, delete on public.casino_room_views from anon, authenticated;
do $$ begin
  alter publication supabase_realtime add table public.casino_room_views;
exception when duplicate_object then null; end $$;

-- Écriture atomique d'un tour de table (appelée uniquement par l'Edge Function, rôle service)
create or replace function public.casino_commit(
  p_code text, p_version int, p_game text, p_room jsonb, p_view jsonb, p_miis jsonb, p_public boolean,
  p_wallets jsonb, p_sessions jsonb, p_spins int[], p_seated uuid[], p_left uuid[])
returns int language plpgsql security definer set search_path to 'public' as $$
declare v int; x jsonb; w wallets;
begin
  if p_version = 0 then
    insert into casino_rooms (code, game, room) values (p_code, p_game, p_room);
    v := 1;
  else
    update casino_rooms set room = p_room, version = version + 1, updated_at = now()
     where code = p_code and version = p_version returning version into v;
    if v is null then raise exception 'conflict'; end if;
  end if;
  insert into casino_room_views (code, game, is_public, players, view, miis, version, updated_at)
  values (p_code, p_game, p_public, coalesce(jsonb_array_length(p_view->'players'), 0), p_view, coalesce(p_miis, '{}'), v, now())
  on conflict (code) do update set is_public = excluded.is_public, players = excluded.players, view = excluded.view,
    miis = excluded.miis, version = excluded.version, updated_at = now();

  for x in select * from jsonb_array_elements(coalesce(p_wallets, '[]')) loop
    update wallets set bankroll = least(greatest((x->>'bankroll')::bigint, 0), 1000000000),
      debt = debt + greatest(coalesce((x->>'debt')::bigint, 0), 0), updated_at = now()
     where user_id = (x->>'uid')::uuid;
  end loop;
  update wallets set seat = p_code, seat_at = now() where user_id = any(coalesce(p_seated, '{}'));
  update wallets set seat = null where user_id = any(coalesce(p_left, '{}')) and seat = p_code;

  for x in select * from jsonb_array_elements(coalesce(p_sessions, '[]')) loop
    select * into w from wallets where user_id = (x->>'uid')::uuid;
    if w.pseudo is not null and not w.banned and not player_banned(w.pseudo) then
      -- classement général des jetons : solde actuel moins la dette
      delete from blackjack_leaderboard where lower(btrim(pseudo)) = lower(w.pseudo);
      insert into blackjack_leaderboard (pseudo, final_bankroll, hands_played, hands_won)
      values (w.pseudo, w.bankroll - w.debt, 0, 0);
    end if;
    if x->>'game' = 'blackjack' then
      perform save_blackjack_session((x->>'session')::uuid, (x->'stats'->>'hands_played')::int, (x->'stats'->>'hands_won')::int,
        (x->'stats'->>'hands_lost')::int, (x->'stats'->>'hands_push')::int, (x->'stats'->>'total_wagered')::numeric,
        (x->'stats'->>'net_result')::numeric, (x->'stats'->>'splits_used')::int, (x->'stats'->>'doubles_used')::int,
        (x->'stats'->>'blackjacks_hit')::int, (x->'stats'->>'final_bankroll')::numeric, (x->'stats'->>'peak')::numeric,
        (x->'stats'->>'drawdown')::numeric, (x->'stats'->>'credit')::numeric);
    elsif x->>'game' = 'roulette' then
      perform save_roulette_session((x->>'session')::uuid, coalesce(w.pseudo, 'Joueur'), (x->'stats'->>'spins')::int,
        (x->'stats'->>'wins')::int, (x->'stats'->>'wagered')::numeric, (x->'stats'->>'net')::numeric,
        (x->'stats'->>'biggest')::numeric, (x->'stats'->>'peak')::numeric, (x->'stats'->>'credit')::numeric,
        (x->'stats'->>'final')::numeric);
    end if;
  end loop;
  if p_spins is not null then
    update roulette_numbers set hits = hits + s.n from (select unnest(p_spins) num, count(*) n from unnest(p_spins) group by 1) s
     where roulette_numbers.num = s.num;
  end if;
  return v;
end $$;
revoke execute on function public.casino_commit(text, int, text, jsonb, jsonb, jsonb, boolean, jsonb, jsonb, int[], uuid[], uuid[]) from anon, authenticated, public;

-- le classement des jetons n'est plus écrit par les navigateurs
drop policy if exists "anon insert" on public.blackjack_leaderboard;
drop policy if exists "anon insert bornes" on public.blackjack_leaderboard;
revoke insert, update, delete on public.blackjack_leaderboard from anon, authenticated;
create or replace function public.replace_old_score() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  new.pseudo := left(btrim(new.pseudo), 20);
  return new;
end $$;
revoke execute on function public.save_blackjack_session(uuid, int, int, int, int, numeric, numeric, int, int, int, numeric, numeric, numeric, numeric),
  public.save_roulette_session(uuid, text, int, int, numeric, numeric, numeric, numeric, numeric, numeric),
  public.record_roulette_spin(int) from anon, authenticated, public;

/* ---------- autres jeux : résultat confirmé par tous les humains ---------- */
create table if not exists public.game_reports (
  game_id uuid not null,
  user_id uuid not null references auth.users on delete cascade,
  game text not null,
  hash text not null,
  payload jsonb not null check (pg_column_size(payload) < 20000),
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
alter table public.game_reports enable row level security;
revoke all on public.game_reports from anon, authenticated;
create table if not exists public.game_finalized (game_id uuid primary key, game text not null, created_at timestamptz not null default now());
alter table public.game_finalized enable row level security;
revoke all on public.game_finalized from anon, authenticated;

-- p_payload = { uids: [uid des humains], args: {p_…: …}, winner_uid?: uid (Monopoly) }
-- Dans args.p_players, chaque humain porte son uid ; son pseudo est remplacé par celui de son portefeuille.
create or replace function public.report_game(p_game text, p_payload jsonb) returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  uid uuid := auth.uid(); gid uuid; uids uuid[]; a jsonb; players jsonb; x jsonb; h text; n int; agree int;
  wp text; humans int;
begin
  if uid is null then raise exception 'non connecte'; end if;
  if p_game not in ('uno','werewolf','buckshot','milleborne','horses','naval','connect4','monopoly') then raise exception 'jeu inconnu'; end if;
  a := p_payload->'args';
  gid := (a->>'p_id')::uuid;
  select array_agg(distinct v::uuid) into uids from jsonb_array_elements_text(p_payload->'uids') v;
  n := coalesce(array_length(uids, 1), 0);
  if gid is null or n not between 1 and 10 or not uid = any(uids) then raise exception 'rapport invalide'; end if;
  if exists (select 1 from game_finalized where game_id = gid) then return 'deja enregistree'; end if;

  -- pseudos des humains = ceux de leurs portefeuilles ; un banni ne compte pas
  if jsonb_typeof(a->'p_players') = 'array' then
    select jsonb_agg(case when coalesce((e->>'bot')::boolean, false) then e - 'uid'
      else (e - 'uid') || jsonb_build_object('pseudo', coalesce((select case when w.banned or player_banned(w.pseudo) then 'Banni' else w.pseudo end
                                                                    from wallets w where w.user_id = (e->>'uid')::uuid), 'Joueur')) end order by ord)
      into players from jsonb_array_elements(a->'p_players') with ordinality t(e, ord);
    select count(*) into humans from jsonb_array_elements(a->'p_players') e where not coalesce((e->>'bot')::boolean, false);
    if humans <> n or exists (select 1 from jsonb_array_elements(a->'p_players') e
        where not coalesce((e->>'bot')::boolean, false) and not ((e->>'uid')::uuid = any(uids))) then raise exception 'joueurs incoherents'; end if;
    a := jsonb_set(a, '{p_players}', players);
  end if;
  if p_game = 'monopoly' then
    if (a->>'p_players')::int - (a->>'p_bots')::int <> n then raise exception 'joueurs incoherents'; end if;
    if p_payload ? 'winner_uid' then
      if not (p_payload->>'winner_uid')::uuid = any(uids) then raise exception 'gagnant inconnu'; end if;
      select pseudo into wp from wallets where user_id = (p_payload->>'winner_uid')::uuid;
      a := a || jsonb_build_object('p_winner', coalesce(wp, 'Joueur'), 'p_winner_is_bot', false);
    else
      a := a || jsonb_build_object('p_winner_is_bot', true);
    end if;
  end if;

  h := md5(p_game || a::text || (select string_agg(u::text, ',' order by u) from unnest(uids) u));
  insert into game_reports (game_id, user_id, game, hash, payload) values (gid, uid, p_game, h, a)
  on conflict (game_id, user_id) do update set hash = excluded.hash, payload = excluded.payload, created_at = now();
  select count(*) into agree from game_reports where game_id = gid and hash = h and user_id = any(uids);
  if agree < n then return 'en attente'; end if;

  insert into game_finalized (game_id, game) values (gid, p_game) on conflict do nothing;
  if not found then return 'deja enregistree'; end if;
  case p_game
    when 'uno' then perform save_uno_game(gid, (a->>'p_rounds')::int, (a->>'p_duration')::int, (a->>'p_turns')::int, (a->>'p_specials')::int,
      (a->>'p_draws')::int, (a->>'p_challenges')::int, (a->>'p_catches')::int, (a->>'p_target')::int, a->'p_players');
    when 'werewolf' then perform save_werewolf_game(gid, (a->>'p_nights')::int, (a->>'p_duration')::int, a->>'p_winner_camp',
      (a->>'p_votes')::int, (a->>'p_night_kills')::int, a->'p_players');
    when 'buckshot' then perform save_buckshot_game(gid, (a->>'p_rounds')::int, (a->>'p_duration')::int, (a->>'p_loads')::int, (a->>'p_shots')::int,
      (a->>'p_hits')::int, (a->>'p_self_blanks')::int, (a->>'p_items')::int, (a->>'p_damage')::int, a->'p_players');
    when 'milleborne' then perform save_milleborne_game(gid, (a->>'p_teams')::boolean, (a->>'p_rounds')::int, (a->>'p_duration')::int,
      (a->>'p_turns')::int, (a->>'p_hazards')::int, (a->>'p_coups')::int, a->'p_players');
    when 'horses' then perform save_horses_game(gid, (a->>'p_duration')::int, (a->>'p_rolls')::int, (a->>'p_sixes')::int,
      (a->>'p_captures')::int, (a->>'p_moves')::int, a->'p_players');
    when 'naval' then perform save_naval_game(gid, (a->>'p_duration')::int, a->'p_players');
    when 'connect4' then perform save_connect4_game(gid, (a->>'p_duration')::int, (a->>'p_rounds')::int, (a->>'p_draws')::int,
      (a->>'p_bot_level')::int, a->'p_players');
    when 'monopoly' then perform save_monopoly_game(gid, (a->>'p_players')::int, (a->>'p_bots')::int, (a->>'p_rounds')::int,
      (a->>'p_duration')::int, a->>'p_winner', (a->>'p_winner_is_bot')::boolean, (a->>'p_props')::int, (a->>'p_hotels')::int,
      (a->>'p_trades')::int, (a->>'p_bankrupt')::int, a->>'p_reason');
  end case;
  return 'enregistree';
end $$;
revoke execute on function public.report_game(text, jsonb) from anon, public;
grant execute on function public.report_game(text, jsonb) to authenticated;

-- les sauvegardes directes ne sont plus appelables depuis le navigateur
revoke execute on function
  public.save_uno_game(uuid, int, int, int, int, int, int, int, int, jsonb),
  public.save_werewolf_game(uuid, int, int, text, int, int, jsonb),
  public.save_buckshot_game(uuid, int, int, int, int, int, int, int, int, jsonb),
  public.save_milleborne_game(uuid, boolean, int, int, int, int, int, jsonb),
  public.save_horses_game(uuid, int, int, int, int, int, jsonb),
  public.save_naval_game(uuid, int, jsonb),
  public.save_connect4_game(uuid, int, int, int, int, jsonb),
  public.save_monopoly_game(uuid, int, int, int, int, text, boolean, int, int, int, int, text)
from anon, authenticated, public;

-- classements : seulement les parties entre au moins deux humains, sans bannis
create or replace function public.get_uno_leaderboard() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int as wins, count(*)::int as games, to_char(max(g.created_at), 'DD/MM/YYYY') as date
    from uno_players p join uno_games g using (game_id)
    where not p.is_bot and g.players - g.bots >= 2 and not player_banned(p.pseudo) and p.pseudo <> 'Banni'
    group by p.pseudo order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$$;
create or replace function public.get_werewolf_leaderboard() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int as wins, count(*)::int as games, to_char(max(g.created_at), 'DD/MM/YYYY') as date
    from werewolf_players p join werewolf_games g using (game_id)
    where not p.is_bot and g.players - g.bots >= 2 and not player_banned(p.pseudo) and p.pseudo <> 'Banni'
    group by p.pseudo order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$$;
create or replace function public.get_buckshot_leaderboard() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int as wins, count(*)::int as games, to_char(max(g.created_at), 'DD/MM/YYYY') as date
    from buckshot_players p join buckshot_games g using (game_id)
    where not p.is_bot and g.players - g.bots >= 2 and not player_banned(p.pseudo) and p.pseudo <> 'Banni'
    group by p.pseudo order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$$;
create or replace function public.get_connect4_leaderboard() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int wins, count(*)::int games, to_char(max(g.created_at), 'DD/MM/YYYY') date
    from connect4_players p join connect4_games g using (game_id)
    where not p.is_bot and g.players - g.bots >= 2 and not player_banned(p.pseudo) and p.pseudo <> 'Banni'
    group by p.pseudo order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$$;
create or replace function public.get_horses_leaderboard() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int wins, count(*)::int games, to_char(max(g.created_at), 'DD/MM/YYYY') date
    from horses_players p join horses_games g using (game_id)
    where not p.is_bot and g.players - g.bots >= 2 and not player_banned(p.pseudo) and p.pseudo <> 'Banni'
    group by p.pseudo order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$$;
create or replace function public.get_milleborne_leaderboard() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int wins, count(*)::int games, to_char(max(g.created_at), 'DD/MM/YYYY') date
    from milleborne_players p join milleborne_games g using (game_id)
    where not p.is_bot and g.players - g.bots >= 2 and not player_banned(p.pseudo) and p.pseudo <> 'Banni'
    group by p.pseudo order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$$;
create or replace function public.get_naval_leaderboard() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select p.pseudo, count(*) filter (where p.won)::int wins, count(*)::int games, to_char(max(g.created_at), 'DD/MM/YYYY') date
    from naval_players p join naval_games g using (game_id)
    where not p.is_bot and g.players - g.bots >= 2 and not player_banned(p.pseudo) and p.pseudo <> 'Banni'
    group by p.pseudo order by wins desc, games asc, max(g.created_at) desc limit 10) r;
$$;
create or replace function public.get_monopoly_leaderboard() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select winner as pseudo, count(*)::int as wins, to_char(max(created_at), 'DD/MM/YYYY') as date
    from monopoly_games where winner is not null and not winner_is_bot and players - bots >= 2 and not player_banned(winner)
    group by winner order by wins desc, max(created_at) desc limit 10) r;
$$;

/* ---------- TrackMerdia : temps acceptés uniquement après rejeu serveur ---------- */
revoke execute on function public.racing_submit(text, text, int, jsonb) from anon, authenticated, public;
