-- Anti-triche Casino : validation serveur des soldes, bans globaux, nettoyage.
-- Rien n'est effacé sans copie : tout ce qui est retiré part dans cheat_quarantine.

create table if not exists public.cheat_quarantine (id bigserial primary key, src text not null, data jsonb not null, reason text, created_at timestamptz not null default now());
alter table public.cheat_quarantine enable row level security;
create table if not exists public.player_bans (pseudo_lower text primary key, reason text, created_at timestamptz not null default now());
alter table public.player_bans enable row level security;

create or replace function public.player_banned(p text) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from player_bans where pseudo_lower = lower(btrim(coalesce(p,''))))
      or exists (select 1 from racing_bans where pseudo_lower = lower(btrim(coalesce(p,''))));
$$;
create or replace function public.racing_banned(p text) returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.player_banned(p);
$$;

insert into player_bans (pseudo_lower, reason) values
  ('sofia', 'solde falsifié : roulette 1 131 Md, classement blackjack 14,1 Md (12/10/2026)')
on conflict do nothing;

-- Nettoyage blackjack / roulette
alter table public.blackjack_leaderboard add column if not exists hidden boolean not null default false;
insert into cheat_quarantine (src, data, reason) select 'blackjack_leaderboard', to_jsonb(b), 'solde impossible ou pseudo banni'
  from blackjack_leaderboard b where abs(final_bankroll) > 1000000 or player_banned(pseudo);
update blackjack_leaderboard set hidden = true where abs(final_bankroll) > 1000000 or player_banned(pseudo);
insert into cheat_quarantine (src, data, reason) select 'blackjack_sessions', to_jsonb(s), 'solde client falsifié'
  from blackjack_sessions s where final_bankroll > 1000000 or peak_bankroll > 1000000 or abs(net_result) > 10000000;
delete from blackjack_sessions where final_bankroll > 1000000 or peak_bankroll > 1000000 or abs(net_result) > 10000000;
insert into cheat_quarantine (src, data, reason) select 'roulette_sessions', to_jsonb(r), 'solde client falsifié ou pseudo banni'
  from roulette_sessions r where final_bankroll > 1000000 or peak_bankroll > 1000000 or abs(net_result) > 10000000 or player_banned(pseudo);
delete from roulette_sessions where final_bankroll > 1000000 or peak_bankroll > 1000000 or abs(net_result) > 10000000 or player_banned(pseudo);

-- Racing : records qui échouent aux contrôles de fantôme
insert into cheat_quarantine (src, data, reason) select 'racing_records', to_jsonb(r) - 'ghost', racing_ghost_problem(r.map_id, r.time_ms, r.ghost)
  from racing_records r where r.map_id not like 'off-%' and r.map_id not like 'zz-%'
   and racing_ghost_problem(r.map_id, r.time_ms, r.ghost) in ('vitesse impossible','durée du fantôme ≠ temps','hors piste','mauvais départ','arrivée non atteinte','checkpoint manqué');
delete from racing_records r where r.map_id not like 'off-%' and r.map_id not like 'zz-%'
   and racing_ghost_problem(r.map_id, r.time_ms, r.ghost) in ('vitesse impossible','durée du fantôme ≠ temps','hors piste','mauvais départ','arrivée non atteinte','checkpoint manqué');

create or replace function public.get_blackjack_leaderboard()
 returns table(pseudo text, bankroll bigint, hands integer, date text)
 language sql stable security definer set search_path to 'public' as $$
  select pseudo, final_bankroll::bigint, hands_played, to_char(created_at,'DD/MM/YYYY')
  from blackjack_leaderboard where not hidden and not player_banned(pseudo)
  order by final_bankroll desc, created_at asc limit 20;
$$;
create or replace function public.get_roulette_leaderboard() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select pseudo, round(net_result)::bigint as net, spins, to_char(updated_at, 'DD/MM/YYYY') as date
    from roulette_sessions where spins > 0 and not player_banned(pseudo)
    order by net_result desc, updated_at desc limit 10) r;
$$;

-- Insertion directe dans le classement : bornes réalistes, pseudo non banni (était « with check (true) »)
drop policy if exists "anon insert" on public.blackjack_leaderboard;
drop policy if exists "anon insert bornes" on public.blackjack_leaderboard;
create policy "anon insert bornes" on public.blackjack_leaderboard for insert to anon, authenticated
 with check (hidden = false and final_bankroll between -1000000 and 1000000
   and hands_played between 0 and 100000 and hands_won between 0 and hands_played
   and char_length(btrim(pseudo)) between 1 and 20 and not public.player_banned(pseudo));
drop policy if exists "anon insert" on public.blackjack_sessions;

-- N'importe qui pouvait effacer le score d'un autre en postant son pseudo avec un petit score
create or replace function public.replace_old_score() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  new.pseudo := left(btrim(new.pseudo), 20);
  if exists (select 1 from blackjack_leaderboard where lower(btrim(pseudo)) = lower(new.pseudo) and not hidden and final_bankroll >= new.final_bankroll) then
    return null;
  end if;
  delete from blackjack_leaderboard where lower(btrim(pseudo)) = lower(new.pseudo) and not hidden;
  return new;
end $$;

create or replace function public.save_blackjack_session(p_id uuid, p_hands_played integer, p_hands_won integer, p_hands_lost integer, p_hands_push integer, p_total_wagered numeric, p_net_result numeric, p_splits_used integer, p_doubles_used integer, p_blackjacks_hit integer, p_final_bankroll numeric, p_peak numeric, p_drawdown numeric, p_credit numeric)
 returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_id is null or coalesce(p_hands_played,0) <= 0 or p_hands_played > 100000 then return; end if;
  if coalesce(p_hands_won,-1) < 0 or coalesce(p_hands_lost,-1) < 0 or coalesce(p_hands_push,-1) < 0
     or p_hands_won + p_hands_lost + p_hands_push > p_hands_played * 4 then return; end if;
  if coalesce(p_final_bankroll,-1) not between 0 and 1000000 or coalesce(p_peak,-1) not between 0 and 1000000
     or coalesce(p_credit,0) not between 0 and 1000000 or coalesce(p_drawdown,0) not between 0 and 10000000
     or coalesce(p_total_wagered,-1) not between 0 and 1000000000 or abs(coalesce(p_net_result, 1e18)) > 10000000 then return; end if;
  insert into blackjack_sessions (session_id, hands_played, hands_won, hands_lost, hands_push,
    total_wagered, net_result, splits_used, doubles_used, blackjacks_hit, final_bankroll, peak_bankroll, max_drawdown, credit_taken)
  values (p_id, p_hands_played, p_hands_won, p_hands_lost, p_hands_push, p_total_wagered, p_net_result,
    p_splits_used, p_doubles_used, p_blackjacks_hit, p_final_bankroll, p_peak, p_drawdown, p_credit)
  on conflict (session_id) do update set
    hands_played = excluded.hands_played, hands_won = excluded.hands_won, hands_lost = excluded.hands_lost,
    hands_push = excluded.hands_push, total_wagered = excluded.total_wagered, net_result = excluded.net_result,
    splits_used = excluded.splits_used, doubles_used = excluded.doubles_used, blackjacks_hit = excluded.blackjacks_hit,
    final_bankroll = excluded.final_bankroll, peak_bankroll = excluded.peak_bankroll,
    max_drawdown = excluded.max_drawdown, credit_taken = excluded.credit_taken;
end $$;

create or replace function public.save_roulette_session(p_id uuid, p_pseudo text, p_spins integer, p_wins integer, p_wagered numeric, p_net numeric, p_biggest numeric, p_peak numeric, p_credit numeric, p_final numeric)
 returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_id is null or p_spins is null or p_spins <= 0 or p_spins > 100000 or player_banned(p_pseudo) then return; end if;
  if coalesce(p_wins,-1) not between 0 and p_spins or coalesce(p_wagered,-1) not between 0 and 1000000000
     or abs(coalesce(p_net,1e18)) > 10000000 or coalesce(p_biggest,0) > 10000000
     or coalesce(p_final,-1) not between 0 and 1000000 or coalesce(p_peak,-1) not between 0 and 1000000
     or coalesce(p_credit,0) not between 0 and 1000000 then return; end if;
  insert into roulette_sessions (session_id, pseudo, spins, wins, total_wagered, net_result, biggest_win, peak_bankroll, credit_taken, final_bankroll)
  values (p_id, left(coalesce(nullif(trim(p_pseudo), ''), 'Joueur'), 20), p_spins, p_wins, p_wagered,
    p_net, greatest(p_biggest, 0), p_peak, greatest(p_credit, 0), p_final)
  on conflict (session_id) do update set
    pseudo = excluded.pseudo, spins = excluded.spins, wins = excluded.wins, total_wagered = excluded.total_wagered,
    net_result = excluded.net_result, biggest_win = excluded.biggest_win, peak_bankroll = excluded.peak_bankroll,
    credit_taken = excluded.credit_taken, final_bankroll = excluded.final_bankroll, updated_at = now();
end $$;

-- Bannis : leurs futures parties ne comptent plus dans aucun jeu
create or replace function public.reject_banned_player() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if not coalesce(new.is_bot, false) and player_banned(new.pseudo) then new.pseudo := 'Banni'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['uno_players','werewolf_players','buckshot_players','milleborne_players','horses_players','naval_players','connect4_players'] loop
    execute format('drop trigger if exists trg_reject_banned on public.%I', t);
    execute format('create trigger trg_reject_banned before insert on public.%I for each row execute function public.reject_banned_player()', t);
  end loop;
end $$;

-- Sauvegardes cloud : solde borné (sinon un compte réinjecte un solde truqué)
update user_save_active set data = jsonb_set(data, '{wallet,bankroll}', '1000') where (data->'wallet'->>'bankroll')::numeric > 1000000;
update user_saves set data = jsonb_set(data, '{wallet,bankroll}', '1000') where (data->'wallet'->>'bankroll')::numeric > 1000000;
alter table user_save_active drop constraint if exists wallet_bounds;
alter table user_save_active add constraint wallet_bounds check (coalesce((data->'wallet'->>'bankroll')::numeric, 0) between 0 and 1000000);
alter table user_saves drop constraint if exists wallet_bounds;
alter table user_saves add constraint wallet_bounds check (coalesce((data->'wallet'->>'bankroll')::numeric, 0) between 0 and 1000000);

-- Privilèges inutiles exposés au client
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke insert, update, delete on public.blackjack_sessions, public.roulette_sessions, public.roulette_numbers, public.racing_records,
  public.racing_events, public.racing_maps, public.racing_bans, public.racing_rejected, public.racing_official,
  public.cheat_quarantine, public.player_bans from anon, authenticated;
revoke select on public.cheat_quarantine, public.player_bans from anon, authenticated;
