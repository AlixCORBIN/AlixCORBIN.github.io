-- TrackMerdia : le hors-piste n'est plus refusé par l'anti-triche (toutes saisons). Migration à appliquer à la main.
-- Couper par le décor ou trouver un autre chemin est permis ; l'anti-triche ne vise que les fausses données :
-- durée du fantôme, vitesse impossible, départ, arrivée et passage par chaque checkpoint restent contrôlés.
-- Comme racing-season2-anticheat.sql, on relit la définition actuelle de racing_ghost_problem et on n'en retire que
-- le bloc « loin de la piste » ; si ce bloc n'est pas trouvé exactement une fois, la migration échoue sans rien changer.
do $mig$
declare
  def text;
  a int;
  b int;
  head text := '  -- loin de la piste (un point sur 3)';
  tail text := 'if off > checked * 0.15 then return ''hors piste''; end if;';
begin
  select pg_get_functiondef('public.racing_ghost_problem(text, integer, jsonb)'::regprocedure) into def;
  if strpos(def, tail) = 0 then raise notice 'racing_ghost_problem ne contrôle déjà plus le hors-piste'; return; end if;
  if (length(def) - length(replace(def, head, ''))) / length(head) <> 1
     or (length(def) - length(replace(def, tail, ''))) / length(tail) <> 1 then
    raise exception 'racing_ghost_problem : bloc hors piste introuvable ou en double';
  end if;
  a := strpos(def, head);
  b := strpos(def, tail) + length(tail);
  if b <= a then raise exception 'racing_ghost_problem : bloc hors piste mal délimité'; end if;
  def := left(def, a - 1) || '  -- hors-piste permis : seules les fausses données sont refusées' || substr(def, b);
  execute def;
end $mig$;
