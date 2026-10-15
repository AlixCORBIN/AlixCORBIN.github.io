-- Export du lundi 26/10 (SQL Editor, bouton "Download CSV"). Prend la dernière sauvegarde de chaque type.

-- TrackMerdia
select d->>'map_id' as map_id, d->>'pseudo' as pseudo, (d->>'time_ms')::int as time_ms,
       d->>'discord_name' as discord_name, d->>'discord_id' as discord_id,
       d->>'user_id' as user_id, d->>'updated_at' as updated_at
from public.tournament_save s, lateral (select s.data as d) x
where s.kind = 'racing'
  and s.saved_at = (select max(saved_at) from public.tournament_save where kind = 'racing')
order by map_id, time_ms, updated_at;

-- Casino
select d->>'pseudo' as pseudo, (d->>'net')::bigint as net, (d->>'bankroll')::bigint as bankroll,
       (d->>'debt')::bigint as debt, (d->>'banned')::boolean as banned,
       d->>'discord_name' as discord_name, d->>'discord_id' as discord_id,
       d->>'user_id' as user_id, d->>'updated_at' as updated_at
from public.tournament_save s, lateral (select s.data as d) x
where s.kind = 'casino'
  and s.saved_at = (select max(saved_at) from public.tournament_save where kind = 'casino')
order by net desc, updated_at;
