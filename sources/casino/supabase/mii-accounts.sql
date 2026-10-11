-- Comptes optionnels : sauvegarde des Mii d'un utilisateur connecté (Supabase Auth).
-- Chaque ligne n'est lisible et modifiable que par son propriétaire (RLS).

create table if not exists public.user_miis (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data jsonb not null check (octet_length(data::text) < 8000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.user_mii_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  main_id text check (main_id is null or char_length(main_id) <= 64),
  updated_at timestamptz not null default now()
);

alter table public.user_miis enable row level security;
alter table public.user_mii_settings enable row level security;

create policy "miis: lecture perso" on public.user_miis for select to authenticated using ((select auth.uid()) = user_id);
create policy "miis: ajout perso" on public.user_miis for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "miis: maj perso" on public.user_miis for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "miis: suppression perso" on public.user_miis for delete to authenticated using ((select auth.uid()) = user_id);

create policy "mii settings: lecture perso" on public.user_mii_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "mii settings: ajout perso" on public.user_mii_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mii settings: maj perso" on public.user_mii_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 100 Mii maximum par compte
create or replace function public.user_miis_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- un upsert passe aussi par ce trigger : une mise à jour ne compte pas
  if exists (select 1 from public.user_miis where user_id = new.user_id and id = new.id) then
    return new;
  end if;
  if (select count(*) from public.user_miis where user_id = new.user_id) >= 100 then
    raise exception 'mii limit reached';
  end if;
  return new;
end $$;
revoke execute on function public.user_miis_limit() from public, anon, authenticated;

drop trigger if exists user_miis_limit on public.user_miis;
create trigger user_miis_limit before insert on public.user_miis for each row execute function public.user_miis_limit();

grant select, insert, update, delete on public.user_miis to authenticated;
grant select, insert, update on public.user_mii_settings to authenticated;
