-- Latence des tables d'argent : une seule lecture par action (portefeuille + bannissement + salle).
-- Appelée uniquement par l'Edge Function casino-table (rôle service). Relançable.
create or replace function public.casino_load(p_uid uuid, p_code text default null) returns json
language plpgsql security definer set search_path to 'public' as $$
declare w wallets; r json;
begin
  insert into wallets (user_id) values (p_uid) on conflict do nothing;
  select * into w from wallets where user_id = p_uid;
  if p_code is not null then
    select json_build_object('room', room, 'version', version) into r from casino_rooms where code = p_code;
  end if;
  return json_build_object(
    'wallet', json_build_object('pseudo', w.pseudo, 'bankroll', w.bankroll, 'seat', w.seat, 'seat_at', w.seat_at),
    'banned', w.banned or player_banned(w.pseudo),
    'room', r);
end $$;
revoke execute on function public.casino_load(uuid, text) from anon, authenticated, public;
