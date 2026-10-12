-- Correctif : report_game plantait pour Monopoly (p_players y est un nombre, pas une liste).
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
