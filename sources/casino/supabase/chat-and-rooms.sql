-- Chat général relié au compte + salles privées réservées à leurs joueurs.
-- À appliquer après server-authority.sql. Relançable.

/* ---------- chat : le nom affiché est le pseudo du compte ---------- */
-- Si le compte n'a pas encore de pseudo, on réserve celui demandé (s'il est libre et non banni),
-- sinon le message part sous « Invité xxxx ».
create or replace function public.chat_say(p_msg text, p_game text default null, p_name text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); nm text; w wallets;
begin
  if uid is null then raise exception 'non connecte'; end if;
  p_msg := btrim(coalesce(p_msg, ''));
  if char_length(p_msg) not between 1 and 300 then raise exception 'message invalide'; end if;
  insert into wallets (user_id) values (uid) on conflict do nothing;
  select * into w from wallets where user_id = uid;
  if w.banned or player_banned(w.pseudo) then raise exception 'compte banni'; end if;
  nm := w.pseudo;
  if nm is null then
    p_name := btrim(coalesce(p_name, ''));
    if char_length(p_name) between 1 and 16 and p_name <> 'Joueur' and not player_banned(p_name)
       and not exists (select 1 from wallets where lower(pseudo) = lower(p_name)) then
      update wallets set pseudo = p_name, updated_at = now() where user_id = uid;
      nm := p_name;
    else
      nm := 'Invité ' || upper(substr(replace(uid::text, '-', ''), 1, 4));
    end if;
  end if;
  insert into global_chat (name, msg, game) values (left(nm, 20), p_msg, nullif(left(btrim(coalesce(p_game, '')), 20), ''));
end $$;
revoke execute on function public.chat_say(text, text, text) from anon, public;
grant execute on function public.chat_say(text, text, text) to authenticated;

-- plus d'écriture directe : seul chat_say peut poster
revoke insert, update, delete on public.global_chat from anon, authenticated;

-- les messages arrivent en direct depuis la table (plus de diffusion libre où chacun choisit son nom)
do $$ begin
  alter publication supabase_realtime add table public.global_chat;
exception when duplicate_object then null; end $$;

/* ---------- salles d'argent : une salle privée n'est lisible que par ses joueurs ---------- */
alter policy "vue publique" on public.casino_room_views using (
  is_public
  or exists (select 1 from jsonb_array_elements(coalesce(view->'players', '[]'::jsonb)) p where p->>'id' = (select auth.uid())::text)
);

-- Rejoindre par code : savoir si le code correspond à une table serveur, sans en lire le contenu
create or replace function public.casino_room_game(p_code text) returns text
language sql stable security definer set search_path to 'public' as $$
  select game from casino_rooms where code = upper(btrim(p_code));
$$;
revoke execute on function public.casino_room_game(text) from public;
grant execute on function public.casino_room_game(text) to anon, authenticated;
