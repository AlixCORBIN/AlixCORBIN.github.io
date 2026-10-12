-- Blackjack rapide : les actions en cours de main (tirer, rester, doubler, splitter, assurance)
-- sont jouées directement dans la base, en un seul appel (~70 ms au lieu de ~400 ms via l'Edge Function).
-- Même logique que src/games/blackjack/engine.js (hit, stand, doubleDown, split, decideInsurance, advanceTurn)
-- et que src/server/tables.js (minuteries, vue publique, portefeuille).
-- Distribution, croupier, règlement et remélange restent dans casino-table : dans ces cas, bj_act répond
-- {"fallback": true} et le navigateur repasse par la fonction. Relançable.

create or replace function public.bj_card_value(r text) returns int language sql immutable as $$
  select case when r = 'A' then 11 when r in ('10','J','Q','K') then 10 else r::int end;
$$;

-- total d'une main (les cartes cachées ne comptent pas), as à 1 si besoin
create or replace function public.bj_hand_total(cards jsonb) returns int language plpgsql immutable as $$
declare total int := 0; aces int := 0; c jsonb;
begin
  for c in select * from jsonb_array_elements(coalesce(cards, '[]')) loop
    if coalesce((c->>'hidden')::boolean, false) then continue; end if;
    total := total + bj_card_value(c->>'r');
    if c->>'r' = 'A' then aces := aces + 1; end if;
  end loop;
  while total > 21 and aces > 0 loop total := total - 10; aces := aces - 1; end loop;
  return total;
end $$;

create or replace function public.bj_is_natural(hand jsonb) returns boolean language sql immutable as $$
  select jsonb_array_length(hand->'cards') = 2 and not coalesce((hand->>'split')::boolean, false) and bj_hand_total(hand->'cards') = 21;
$$;

-- passe au joueur / à la main suivante qui doit jouer (sinon : tour du croupier)
create or replace function public.bj_advance_turn(g jsonb) returns jsonb language plpgsql immutable as $$
declare pi int; hi int; np int; nh int;
begin
  g := jsonb_set(g, '{turn}', 'null');
  np := jsonb_array_length(g->'players');
  for pi in 0 .. np - 1 loop
    nh := jsonb_array_length(g->'players'->pi->'hands');
    for hi in 0 .. nh - 1 loop
      if not coalesce((g->'players'->pi->'hands'->hi->>'done')::boolean, false) then
        if coalesce((g->'players'->pi->>'left')::boolean, false) then
          g := jsonb_set(g, array['players', pi::text, 'hands', hi::text, 'done'], 'true');
          continue;
        end if;
        return jsonb_set(g, '{turn}', jsonb_build_object('p', pi, 'h', hi));
      end if;
    end loop;
  end loop;
  return jsonb_set(g, '{phase}', '"dealer"');
end $$;

create or replace function public.bj_act(p_code text, p_action jsonb) returns json
language plpgsql security definer set search_path to 'public' as $$
declare
  uid uuid := auth.uid(); me text; r jsonb; v int; g jsonb; now_ms bigint; t text;
  pi int; hi int; np int; ui int; player jsonb; hand jsonb; card jsonb; cost bigint; bet bigint;
  two boolean; aces boolean; h1 jsonb; h2 jsonb; hands jsonb; sig text; multi boolean; due bigint; v_view jsonb; v_miis jsonb;
  all_decided boolean;
begin
  if uid is null then raise exception 'non connecte'; end if;
  me := uid::text;
  t := p_action->>'t';
  if t not in ('hit', 'stand', 'double', 'split', 'insurance') then return json_build_object('fallback', true); end if;
  now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  select room, version into r, v from casino_rooms where code = upper(btrim(p_code)) and game = 'blackjack' for update;
  if r is null then return json_build_object('fallback', true); end if;
  -- minuterie échue (croupier, inactivité…) ou membre inconnu : la fonction s'en occupe
  if exists (select 1 from jsonb_each_text(coalesce(r->'timers', '{}')) e where e.value::bigint <= now_ms) then
    return json_build_object('fallback', true);
  end if;
  if r->'members'->me is null or coalesce((r->'members'->me->>'kicked')::boolean, false) then return json_build_object('fallback', true); end if;
  if exists (select 1 from wallets w where w.user_id = uid and (w.banned or player_banned(w.pseudo))) then raise exception 'compte banni'; end if;

  g := r->'g';
  np := jsonb_array_length(g->'players');

  if t = 'insurance' then
    if g->>'phase' <> 'insurance' then return json_build_object('ok', false, 'error', 'impossible'); end if;
    select (o - 1)::int into pi from jsonb_array_elements(g->'players') with ordinality x(p, o) where p->>'id' = me;
    if pi is null then return json_build_object('ok', false, 'error', 'impossible'); end if;
    player := g->'players'->pi;
    if coalesce((player->>'insuranceDecided')::boolean, false) or jsonb_array_length(player->'hands') = 0 then
      return json_build_object('ok', false, 'error', 'impossible');
    end if;
    if coalesce((p_action->>'take')::boolean, false) then
      cost := floor((player->'hands'->0->>'bet')::numeric / 2);
      if cost < 1 or cost > (player->>'bankroll')::numeric then return json_build_object('ok', false, 'error', 'solde insuffisant'); end if;
      player := jsonb_set(player, '{bankroll}', to_jsonb((player->>'bankroll')::numeric - cost));
      player := jsonb_set(player, '{stats,wagered}', to_jsonb((player->'stats'->>'wagered')::numeric + cost));
      player := jsonb_set(player, '{insurance}', to_jsonb(cost));
    end if;
    player := jsonb_set(player, '{insuranceDecided}', 'true');
    g := jsonb_set(g, array['players', pi::text], player);
    select bool_and(coalesce((p->>'insuranceDecided')::boolean, false)) into all_decided from jsonb_array_elements(g->'players') p;
    if all_decided then
      -- startPlay : les blackjacks naturels sont terminés, puis premier joueur
      g := jsonb_set(g, '{phase}', '"playing"');
      for pi in 0 .. np - 1 loop
        for hi in 0 .. jsonb_array_length(g->'players'->pi->'hands') - 1 loop
          if bj_is_natural(g->'players'->pi->'hands'->hi) then
            g := jsonb_set(g, array['players', pi::text, 'hands', hi::text, 'done'], 'true');
          end if;
        end loop;
      end loop;
      g := bj_advance_turn(g);
    end if;
  else
    if g->>'phase' <> 'playing' or g->'turn' is null or g->'turn' = 'null'::jsonb then
      return json_build_object('ok', false, 'error', 'impossible');
    end if;
    pi := (g->'turn'->>'p')::int;
    hi := (g->'turn'->>'h')::int;
    player := g->'players'->pi;
    if player->>'id' <> me then return json_build_object('ok', false, 'error', 'impossible'); end if;
    hand := player->'hands'->hi;
    two := jsonb_array_length(hand->'cards') = 2;
    bet := (hand->>'bet')::bigint;
    -- tirer ou splitter peut vider le sabot : remélange = cas rare, laissé à la fonction
    if t in ('hit', 'double', 'split') and jsonb_array_length(g->'shoe') < 2 then return json_build_object('fallback', true); end if;

    if t = 'stand' then
      g := jsonb_set(g, array['players', pi::text, 'hands', hi::text, 'done'], 'true');
      g := bj_advance_turn(g);

    elsif t = 'hit' then
      if coalesce((hand->>'aceSplit')::boolean, false) then return json_build_object('ok', false, 'error', 'impossible'); end if;
      card := g->'shoe'->-1;
      g := jsonb_set(g, '{shoe}', (g->'shoe') - (jsonb_array_length(g->'shoe') - 1));
      hand := jsonb_set(hand, '{cards}', (hand->'cards') || jsonb_build_array(card));
      if bj_hand_total(hand->'cards') >= 21 then hand := jsonb_set(hand, '{done}', 'true'); end if;
      g := jsonb_set(g, array['players', pi::text, 'hands', hi::text], hand);
      if (hand->>'done')::boolean then g := bj_advance_turn(g); end if;

    elsif t = 'double' then
      if not two or coalesce((hand->>'aceSplit')::boolean, false) or (player->>'bankroll')::numeric < bet then
        return json_build_object('ok', false, 'error', 'impossible');
      end if;
      player := jsonb_set(player, '{bankroll}', to_jsonb((player->>'bankroll')::numeric - bet));
      player := jsonb_set(player, '{stats,wagered}', to_jsonb((player->'stats'->>'wagered')::numeric + bet));
      player := jsonb_set(player, '{stats,doubles}', to_jsonb((player->'stats'->>'doubles')::int + 1));
      card := g->'shoe'->-1;
      g := jsonb_set(g, '{shoe}', (g->'shoe') - (jsonb_array_length(g->'shoe') - 1));
      hand := hand || jsonb_build_object('bet', bet * 2, 'doubled', true, 'done', true, 'cards', (hand->'cards') || jsonb_build_array(card));
      player := jsonb_set(player, array['hands', hi::text], hand);
      g := jsonb_set(g, array['players', pi::text], player);
      g := bj_advance_turn(g);

    elsif t = 'split' then
      if not two or coalesce((hand->>'aceSplit')::boolean, false) or jsonb_array_length(player->'hands') >= 4
         or (player->>'bankroll')::numeric < bet
         or bj_card_value(hand->'cards'->0->>'r') <> bj_card_value(hand->'cards'->1->>'r') then
        return json_build_object('ok', false, 'error', 'impossible');
      end if;
      aces := hand->'cards'->0->>'r' = 'A';
      player := jsonb_set(player, '{bankroll}', to_jsonb((player->>'bankroll')::numeric - bet));
      player := jsonb_set(player, '{stats,wagered}', to_jsonb((player->'stats'->>'wagered')::numeric + bet));
      player := jsonb_set(player, '{stats,splits}', to_jsonb((player->'stats'->>'splits')::int + 1));
      -- même ordre de tirage que le moteur : 2e carte de la 1re main, puis 2e carte de la 2e main
      card := g->'shoe'->-1;
      g := jsonb_set(g, '{shoe}', (g->'shoe') - (jsonb_array_length(g->'shoe') - 1));
      h1 := jsonb_build_object('cards', jsonb_build_array(hand->'cards'->0, card), 'bet', bet, 'done', false, 'split', true,
        'doubled', false, 'aceSplit', aces, 'result', null, 'payout', 0);
      card := g->'shoe'->-1;
      g := jsonb_set(g, '{shoe}', (g->'shoe') - (jsonb_array_length(g->'shoe') - 1));
      h2 := jsonb_build_object('cards', jsonb_build_array(hand->'cards'->1, card), 'bet', bet, 'done', false, 'split', true,
        'doubled', false, 'aceSplit', aces, 'result', null, 'payout', 0);
      if aces or bj_hand_total(h1->'cards') = 21 then h1 := jsonb_set(h1, '{done}', 'true'); end if;
      if aces or bj_hand_total(h2->'cards') = 21 then h2 := jsonb_set(h2, '{done}', 'true'); end if;
      select coalesce(jsonb_agg(x order by o), '[]') into hands from (
        select e x, (o * 10) o from jsonb_array_elements(player->'hands') with ordinality hx(e, o) where o - 1 <> hi
        union all select h1, (hi + 1) * 10 - 5
        union all select h2, (hi + 1) * 10 - 4) s;
      player := jsonb_set(player, '{hands}', hands);
      g := jsonb_set(g, array['players', pi::text], player);
      g := bj_advance_turn(g);
    end if;
  end if;

  -- membre actif
  r := jsonb_set(r, array['members', me, 'seen'], to_jsonb(now_ms));
  r := jsonb_set(r, array['members', me, 'act'], to_jsonb(now_ms));
  r := jsonb_set(r, '{g}', g);

  -- minuteries (même règle que scheduleBJ côté fonction)
  select count(*) > 1 into multi from jsonb_array_elements(g->'players') p where not coalesce((p->>'left')::boolean, false);
  sig := concat_ws('|', g->>'phase', g->>'round',
    case when g->'turn' is not null and g->'turn' <> 'null'::jsonb then (g->'turn'->>'p') || '.' || (g->'turn'->>'h') else '' end,
    case when g->'turn' is not null and g->'turn' <> 'null'::jsonb
      then coalesce(jsonb_array_length(g->'players'->((g->'turn'->>'p')::int)->'hands'->((g->'turn'->>'h')::int)->'cards')::text, '') else '' end,
    jsonb_array_length(g->'dealer'->'cards')::text,
    case when coalesce((g->'dealer'->>'hidden')::boolean, false) then 'true' else 'false' end);
  if sig is distinct from r->>'sig' then
    r := jsonb_set(r, '{sig}', to_jsonb(sig));
    r := jsonb_set(r, '{timers}', '{}');
    r := jsonb_set(r, '{afk}', 'null');
    if g->>'phase' = 'dealer' then
      r := jsonb_set(r, '{timers}', jsonb_build_object('dealer', now_ms + case when coalesce((g->'dealer'->>'hidden')::boolean, false) then 900 else 1000 end));
    elsif g->>'phase' = 'insurance' then
      r := jsonb_set(r, '{timers}', jsonb_build_object('ins', now_ms + 8000));
    elsif g->>'phase' = 'playing' and multi and g->'turn' <> 'null'::jsonb then
      r := jsonb_set(r, '{afk}', jsonb_build_object('id', g->'players'->((g->'turn'->>'p')::int)->>'id', 'at', now_ms + 60000));
      r := jsonb_set(r, '{timers}', jsonb_build_object('turn', now_ms + 60000));
    end if;
  end if;

  -- vue publique (comme publicView + view côté fonction) : jamais le sabot ni les clés à venir
  select min(e.value::bigint) into due from jsonb_each_text(coalesce(r->'timers', '{}')) e;
  v_view := (g - 'shoe' - 'rngProof' - 'nextKeys' - 'nextMeta')
    || jsonb_build_object('shoeLeft', jsonb_array_length(g->'shoe'), 'game', 'blackjack', 'isPublic', coalesce(r->'isPublic', 'false'),
       'at', now_ms, 'due', due,
       'afk', case when r->'afk' is null or r->'afk' = 'null'::jsonb then null
              else jsonb_build_object('id', r->'afk'->>'id', 'ids', r->'afk'->'ids', 'kind', r->'afk'->>'kind',
                     'ms', greatest(0, (r->'afk'->>'at')::bigint - now_ms), 'total', coalesce((r->'afk'->>'total')::bigint, 60000)) end,
       'kicked', coalesce((select jsonb_agg(k) from jsonb_each(r->'members') m(k, val) where coalesce((val->>'kicked')::boolean, false)), '[]'));

  v := v + 1;
  update casino_rooms set room = r, version = v, updated_at = now() where code = upper(btrim(p_code));
  select coalesce(jsonb_object_agg(k, val->'mii'), '{}') into v_miis from jsonb_each(r->'members') m(k, val) where val->'mii' is not null and val->'mii' <> 'null'::jsonb;
  update casino_room_views set view = v_view, players = jsonb_array_length(v_view->'players'), version = v, miis = v_miis, updated_at = now()
   where code = upper(btrim(p_code));

  -- solde : la mise engagée (double, split, assurance) part tout de suite du portefeuille
  select (o - 1)::int into ui from jsonb_array_elements(g->'players') with ordinality x(p, o) where p->>'id' = me;
  if ui is not null then
    update wallets set bankroll = greatest(0, floor((g->'players'->ui->>'bankroll')::numeric))::bigint, seat_at = now(), updated_at = now()
     where user_id = uid;
  end if;

  return json_build_object('ok', true, 'version', v, 'code', upper(btrim(p_code)), 'me', me, 'view', v_view);
end $$;
revoke execute on function public.bj_act(text, jsonb) from anon, public;
grant execute on function public.bj_act(text, jsonb) to authenticated;
revoke execute on function public.bj_advance_turn(jsonb) from anon, authenticated, public;
