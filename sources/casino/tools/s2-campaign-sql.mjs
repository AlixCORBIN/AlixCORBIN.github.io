// Campagne de la saison 2 : SQL qui envoie les maps de tools/s2-maps/s2-NN.json dans racing_campaign, avec leurs repères
// anti-triche recalculés (trackMeta de meta.js, comme l'éditeur) et le temps auteur du pilote de référence.
// Passe par la RPC admin_campaign_upsert, exécutée au nom du premier compte de public.admins (la saison reste verrouillée :
// rien ne change pour les joueurs tant que la saison n'est pas ouverte).
//   node tools/s2-campaign-sql.mjs [s2-01 s2-02 …] > campagne.sql   puis exécuter campagne.sql dans l'éditeur SQL de Supabase
import { readFileSync, readdirSync } from "node:fs";
import { trackMeta } from "../src/games/racing/meta.js";

const dir = new URL("./s2-maps/", import.meta.url);
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => /^s2-\d+\.json$/.test(f)).sort();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const lines = [
  "-- Généré par tools/s2-campaign-sql.mjs",
  "select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.admins order by user_id limit 1), 'role', 'authenticated')::text, false);",
];
for (const f of files) {
  const m = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  if (only.length && !only.includes(m.id)) continue;
  if (!m.author_ms) throw new Error(`${m.id} : pas de temps auteur (relancer tools/s2-maps/build.mjs)`);
  const ord = parseInt(m.id.slice(3), 10);
  lines.push(`select public.admin_campaign_upsert(${q(m.id)}, 's2', ${ord}, ${q(m.name)}, ${q(JSON.stringify(m.data))}::jsonb, ${m.author_ms}, null, ${q(JSON.stringify(trackMeta(m.data)))}::jsonb);`);
}
console.log(lines.join("\n"));
