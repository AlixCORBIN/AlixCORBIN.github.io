-- Chat général de la salle de jeux (hub Casino + tous les jeux)
-- Le direct passe par Realtime (broadcast) ; cette table garde l'historique (500 derniers messages).

create table if not exists public.global_chat (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 20),
  msg text not null check (char_length(msg) between 1 and 300),
  game text check (game is null or char_length(game) <= 20),
  created_at timestamptz not null default now()
);
alter table public.global_chat enable row level security;
create policy "global_chat read" on public.global_chat for select to anon, authenticated using (true);
create policy "global_chat insert" on public.global_chat for insert to anon, authenticated
  with check (char_length(btrim(msg)) > 0 and char_length(btrim(name)) > 0);

-- Anti-spam + purge : 1 message/seconde par pseudo, 25 messages max sur 10 s, on garde les 500 derniers
create or replace function public.global_chat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  if (select count(*) from global_chat where created_at > now() - interval '10 seconds') >= 25 then
    raise exception 'chat_flood';
  end if;
  if exists (select 1 from global_chat where name = new.name and created_at > now() - interval '1 second') then
    raise exception 'chat_too_fast';
  end if;
  delete from global_chat where id <= (select id from global_chat order by id desc offset 500 limit 1);
  return new;
end $$;
drop trigger if exists global_chat_guard on public.global_chat;
create trigger global_chat_guard before insert on public.global_chat
  for each row execute function public.global_chat_guard();
