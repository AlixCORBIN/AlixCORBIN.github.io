// Maps officielles : 5 mondes × 5 pistes, décrites au format « tortue » (voir buildTrack dans track.js).
// Les temps de médaille sont calculés à partir du temps auteur (bot de référence, voir tools/).
import { buildTrack, normalizeTiles } from "./track.js";

const RAW = [
  // ---------- Monde 1 : Stadium ----------
  [0, "A01 · Échauffement", "S3 C S Rb S3 C Lb S2 B S2 F S"],
  [0, "A02 · Premier looping", "S2 B S2 O S C Rgb S2 Rb S3 F S"],
  [0, "A03 · Mur droit", "S2 B S2 W S C Lb S3 Lb S2 O S F S"],
  [0, "A04 · Étages", "S2 Us S2 C Rb S2 Rb S Ds S C Lgb S B S2 F S"],
  [0, "A05 · Grand Prix", "S2 B S2 O S C Rgb S U S2 Rb S2 C Wl S Lb D S B K _ _ S C Rb S3 F S"],
  // ---------- Monde 2 : Canyon ----------
  [1, "B01 · Corniche", "S2 Uh S2 C Rgb S3 Dh S C Lb S2 F S"],
  [1, "B02 · Le grand saut", "S B S2 K _ _ S2 C Rb S2 B S K _ _ S C Lgb S2 F S"],
  [1, "B03 · Falaise", "S2 Us Us S C Rb S2 B K _ _ Y S2 C Lgb S Ds S2 F S"],
  [1, "B04 · Gorges", "S B S2 W S2 C Rgb S Uh S C Lb S2 Dh B S2 O S F S"],
  [1, "B05 · Route 66", "S2 B S2 C Rgb S Us S2 C Lgb S B K _ _ Y S2 C Rb S2 Ds S2 W S C Rb S3 F S"],
  // ---------- Monde 3 : Glacier ----------
  [2, "C01 · Patinoire", "S3 C Rgb S I2 S C Lgb S2 F S"],
  [2, "C02 · Verglas", "S2 I S Rb S2 C Lb S I2 C Rgb S2 F S"],
  [2, "C03 · Crevasse", "S2 B K _ _ S2 C Rgb S I S U S C Lgb S D S2 F S"],
  [2, "C04 · Sommet", "S2 Uh S2 C Rb S I Rb S2 C Dh S2 O S F S"],
  [2, "C05 · Avalanche", "S2 B S O S C Rgb S2 I S Rb S C W S Lgb S I2 C Lb S2 F S"],
  // ---------- Monde 4 : Forêt ----------
  [3, "D01 · Sentier", "S T2 C R T2 R T C L S2 F S"],
  [3, "D02 · Clairière", "S2 T Rb T2 C Lb T U T2 C D Rgb S F S"],
  [3, "D03 · Racines", "T2 C R T L T2 B K _ _ T C Rb T2 F S"],
  [3, "D04 · Bûcheron", "S B T2 C Us T2 Rb T C Ds T Lgb T2 C W S F S"],
  [3, "D05 · Grande boucle", "S2 T2 C Rgb T2 L T2 C U S2 O S D C Lb T R T2 B K _ _ T C Lgb S F S"],
  // ---------- Monde 5 : Néon ----------
  [4, "E01 · Néon", "S B S2 O S C Rgb S2 Rgb S B S2 F S"],
  [4, "E02 · Échangeur", "S2 Uh S2 C Rb S3 Rb S5 C Rb S2 Rb S Dh S2 F S"],
  [4, "E03 · Hyperdrive", "S B S B S2 O S C Rgb S B W S C Lgb S B O S F S"],
  [4, "E04 · Tour", "S2 Us S Rb Us S Rb Us C S Rb Us S Rb Us S C Rb S Rb S2 F S"],
  [4, "E05 · Finale", "S B S2 O S C Rgb S Uh S W S C Rb S B K _ _ Y S2 C Rb S2 Ds S2 C Lgb S B O S Lb S2 F S"],
];

// Médailles : auteur < or < argent < bronze (proportionnelles au temps auteur)
export const MEDALS = [
  { id: "author", label: "Auteur", color: "#3fd06b", k: 1 },
  { id: "gold", label: "Or", color: "#ffd23f", k: 1.1 },
  { id: "silver", label: "Argent", color: "#cfd8e3", k: 1.25 },
  { id: "bronze", label: "Bronze", color: "#d08a4a", k: 1.5 },
];
export const medalTimes = (author) => MEDALS.map((m) => ({ ...m, ms: Math.ceil((author * m.k) / 10) * 10 }));
export function medalFor(ms, author) {
  if (ms == null || !author) return null;
  return medalTimes(author).find((m) => ms <= m.ms) || null;
}

import { AUTHOR } from "./author-times.js";

export const OFFICIAL = RAW.map(([world, name, path], i) => {
  const id = `v2-${world + 1}-${(i % 5) + 1}`;
  return {
    id,
    world,
    name,
    official: true,
    data: { v: 1, world, tiles: normalizeTiles(buildTrack(path)) },
    author_time: AUTHOR[id] || 30000,
  };
});

export { RAW as OFFICIAL_RAW };
