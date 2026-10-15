-- Liaison d'un compte Discord au compte du portfolio (tournoi).
-- Prérequis : provider Discord activé + "Allow manual linking" dans Supabase Auth.

create table if not exists public.tournament_discord (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  discord_id          text,
  discord_name        text,
  discord_created_at  timestamptz,
  discord_avatar      text,
  linked_at           timestamptz not null default now()
);
alter table public.tournament_discord enable row level security;
create unique index if not exists tournament_discord_discord_id_key on public.tournament_discord (discord_id);

drop policy if exists tournament_discord_own on public.tournament_discord;
create policy tournament_discord_own on public.tournament_discord
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.tournament_discord from anon, authenticated;

-- Lit l'identité Discord dans auth.identities (jamais ce que le navigateur envoie).
create or replace function public.tournament_link_discord()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  idn record;
  did text;
  nm text;
  av text;
  created timestamptz;
begin
  if uid is null then raise exception 'non connecté'; end if;
  select i.identity_data into idn from auth.identities i where i.user_id = uid and i.provider = 'discord' limit 1;
  if not found then raise exception 'Discord non relié'; end if;

  did := coalesce(idn.identity_data->>'provider_id', idn.identity_data->>'sub');
  if did is null or did !~ '^[0-9]{5,25}$' then raise exception 'identité Discord invalide'; end if;
  nm := coalesce(idn.identity_data#>>'{custom_claims,global_name}', idn.identity_data->>'full_name', idn.identity_data->>'name');
  av := idn.identity_data->>'avatar_url';
  -- date de création du compte Discord, déduite du snowflake
  created := to_timestamp((((did::bigint) >> 22) + 1420070400000) / 1000.0);

  insert into public.tournament_discord (user_id, discord_id, discord_name, discord_created_at, discord_avatar)
  values (uid, did, nm, created, av)
  on conflict (user_id) do update
    set discord_id = excluded.discord_id, discord_name = excluded.discord_name,
        discord_created_at = excluded.discord_created_at, discord_avatar = excluded.discord_avatar;

  return jsonb_build_object('discord_name', nm, 'discord_avatar', av, 'discord_created_at', created);
exception when unique_violation then
  raise exception 'Ce compte Discord est déjà relié à un autre compte';
end $$;

revoke all on function public.tournament_link_discord() from public, anon;
grant execute on function public.tournament_link_discord() to authenticated;
