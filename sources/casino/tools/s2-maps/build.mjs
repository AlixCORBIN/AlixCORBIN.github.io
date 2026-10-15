// Campagne de la saison 2 : construit les 25 maps décrites dans campaign.mjs, les valide et écrit tools/s2-maps/s2-NN.json.
//   node tools/s2-maps/build.mjs                 toutes les maps
//   node tools/s2-maps/build.mjs --world 1       un monde (1 à 5)
//   node tools/s2-maps/build.mjs --map s2-03     une map ; --ascii : plan par case ; --nobot : sans pilote ; --trace
// Validations : piste valide, aucun chevauchement ni croisement trop serré, grille 32×32, 20 à 80 blocs, 3 checkpoints
// minimum, au moins 4 niveaux de dénivelé, pas de ligne droite de plus de 4 blocs sans élément, aucune suite de 4 blocs
// reprise d'une autre map, pilote auto à l'arrivée en 20 à 60 s sans chute, et chaque raccourci terminé par le pilote.
// ground : { relief } pose la map sur un sol (dunes de relief niveaux, voir terrain.js) au lieu du vide.
// Temps auteur = meilleur temps du pilote (ligne sûre ou raccourci).
import { readFileSync, writeFileSync } from "node:fs";
import * as P from "../../src/games/racing/physics.js";
import { botRun } from "../bot-run.mjs";
import { MAPS } from "./campaign.mjs";
import { ascii, build, checkMap, lines, ngrams } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const onlyMap = opt("--map"), onlyWorld = opt("--world");
const W0 = P.WORLDS.findIndex((w) => w.id === "s2tech");

await P.initPhysics();
const built = MAPS.map((m, i) => {
  const id = `s2-${String(i + 1).padStart(2, "0")}`;
  const world = W0 + Math.floor(i / 5);
  try {
    const b = build(m.path, m.start ? { start: m.start } : undefined);
    return { ...m, id, world, ...b };
  } catch (e) {
    return { ...m, id, world, error: e.message };
  }
});

// suites de blocs communes à deux maps
const grams = new Map();
for (const m of built) if (!m.error) for (const g of ngrams(m.tiles, m.info)) { if (!grams.has(g)) grams.set(g, []); grams.get(g).push(m.id); }

let bad = 0;
for (const m of built) {
  if (onlyMap && m.id !== onlyMap) continue;
  if (onlyWorld && m.world - W0 + 1 !== +onlyWorld) continue;
  if (m.error) { console.log(`ÉCHEC ${m.id} ${m.name} — ${m.error}`); bad++; continue; }
  const c = checkMap({ world: m.world, ground: m.ground }, m.tiles, m.info);
  const errs = [...c.errs];
  const dup = [...grams].filter(([g, ids]) => ids.includes(m.id) && new Set(ids).size > 1).map(([g, ids]) => `« ${g} » (${[...new Set(ids)].join(", ")})`);
  if (dup.length) errs.push(`motifs repris : ${dup.slice(0, 2).join(" ; ")}${dup.length > 2 ? ` (+${dup.length - 2})` : ""}`);
  const { main, alts } = lines(m.info);
  const lab = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [m.labels[k] ?? k, v]));
  const slow = lab(m.slow);
  let res = null, altRes = {};
  if (!args.includes("--nobot")) {
    const world = P.WORLDS[m.world];
    res = await botRun(c.track, world, { maxSteps: 100 * 90, hints: { order: main, slow }, trace: args.includes("--trace") });
    if (!res.finished) errs.push(`pilote pas arrivé (ligne ${res.idx}/${res.len}, ${res.respawns} chutes)`);
    else if (res.respawns) errs.push(`pilote : ${res.respawns} chute(s)`);
    for (const [g, order] of Object.entries(alts)) {
      const r = await botRun(c.track, world, { maxSteps: 100 * 90, hints: { order, slow: { ...slow, ...lab(m.altSlow?.[g]) } }, trace: args.includes("--trace-alt") });
      altRes[g] = r;
      if (!r.finished || r.respawns) errs.push(`raccourci ${g} : ${r.finished ? r.respawns + " chute(s)" : `pas arrivé (ligne ${r.idx}/${r.len})`}`);
    }
    if (!Object.keys(alts).length) errs.push("aucun raccourci");
  }
  const times = [res, ...Object.values(altRes)].filter((r) => r?.finished && !r.respawns).map((r) => r.ms);
  const author = times.length ? Math.min(...times) : null;
  if (res && author && (author < 20000 || author > 60000)) errs.push(`durée ${(author / 1000).toFixed(1)} s (attendu 20 à 60 s)`);
  if (errs.length) bad++;
  const altTxt = Object.entries(altRes).map(([g, r]) => `${g} ${r.finished ? (r.ms / 1000).toFixed(2) + " s" : "--"}`).join(", ");
  console.log(`${errs.length ? "ÉCHEC" : "OK   "} ${m.id} ${m.name.padEnd(22)} ${String(c.n).padStart(2)} blocs ${c.size.join("×")} dénivelé ${c.relief} · ${res ? (res.finished ? (res.ms / 1000).toFixed(2) + " s" : "--") : ""}${altTxt ? " · raccourci " + altTxt : ""}${errs.length ? "\n      " + errs.join("\n      ") : ""}`);
  if (args.includes("--ascii")) console.log(ascii(c.track));
  if (!args.includes("--nobot")) {
    const file = new URL(`./${m.id}.json`, import.meta.url);
    const altSlow = Object.fromEntries(Object.keys(alts).map((g) => [g, { ...slow, ...lab(m.altSlow?.[g]) }]));
    const out = { id: m.id, name: m.name, world: m.world, figure: m.figure, author_ms: author, data: c.data, hints: { main, alts, slow, altSlow } };
    writeFileSync(file, JSON.stringify(out));
  }
}
process.exitCode = bad ? 1 : 0;
