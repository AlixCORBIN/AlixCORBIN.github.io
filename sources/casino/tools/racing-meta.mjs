// Calcule pour chaque map officielle les points de contrôle anti-triche (départ, arrivée, checkpoints, axe de la piste)
// et écrit le SQL qui remplit la table racing_official (à relancer si une map officielle change).
// node tools/racing-meta.mjs > meta.sql puis exécuter meta.sql dans l'éditeur SQL de Supabase.
import { OFFICIAL } from "../src/games/racing/maps.js";
import { trackMeta } from "../src/games/racing/meta.js";

const rows = OFFICIAL.map((m) => `('${m.id}', '${JSON.stringify(trackMeta(m.data))}'::jsonb)`);
console.log(`insert into public.racing_official (map_id, meta) values\n${rows.join(",\n")}\non conflict (map_id) do update set meta = excluded.meta;`);
