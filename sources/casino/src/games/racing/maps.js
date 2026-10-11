// Maps officielles : 5 mondes × 5 pistes, décrites au format « tortue » (voir buildTrack dans track.js).
// Les temps de médaille sont calculés à partir du temps auteur (bot de référence, voir tools/).
import { buildTrack, normalizeTiles } from "./track.js";

const RAW = [
  // ---------- Monde 1 : Stadium (prise en main) ----------
  [0, "A01 · Premier tour", "S3 C S2 R S2 C S2 R S3 L S2 F S"],
  [0, "A02 · Chicane", "S2 R L S C S R L S2 C S L R S2 F S"],
  [0, "A03 · Turbo", "S B S3 C R S B S3 R C S2 L S B S2 F S"],
  [0, "A04 · Le pont", "S2 C U S3 R S3 R S4 D S C L S2 F S"],
  [0, "A05 · Grand Prix", "S3 B S2 C R S3 R S C S L S2 L S3 C R S R S2 B S3 F S"],
  // ---------- Monde 2 : Canyon (pentes et sauts) ----------
  [1, "B01 · Dunes", "S2 U S D S C R S U S2 D S R S2 C L S F S"],
  [1, "B02 · Premier saut", "S B S2 K _ S2 C R S3 R S B K _ S2 F S"],
  [1, "B03 · Mesa", "S2 U U S2 C R S3 R S2 D D S C L S2 F S"],
  [1, "B04 · Canyon", "S B K _ S C S R S2 L S B K _ S C R S2 R S U S2 D F S"],
  [1, "B05 · Route 66", "S3 B S3 C R U S3 R S3 D C L S2 B K _ S2 R S4 C R S2 F S"],
  // ---------- Monde 3 : Glacier (glisse) ----------
  [2, "C01 · Patinoire", "S3 C R S3 R S2 C S2 L S2 F S"],
  [2, "C02 · Verglas", "S2 R S2 L S2 C R S R S3 L S C L S2 F S"],
  [2, "C03 · Crevasse", "S2 B K _ S2 C R S2 R S3 C L S2 F S"],
  [2, "C04 · Sommet", "S2 U S U S C R S3 R S D S D C S2 L S2 F S"],
  [2, "C05 · Avalanche", "S3 C R S2 L S2 R S B S3 C R S2 R S2 L S2 C L S3 F S"],
  // ---------- Monde 4 : Forêt (terre, virages serrés) ----------
  [3, "D01 · Sentier", "S T3 C R T2 R T2 C L S2 F S"],
  [3, "D02 · Clairière", "S2 R T L T C R T R S2 C L T L S2 F S"],
  [3, "D03 · Racines", "T2 C R T L T R T2 C U S2 D R S2 F S"],
  [3, "D04 · Bûcheron", "S B T3 C R T2 K _ T C R T R T3 C L S2 F S"],
  [3, "D05 · Grande boucle", "S2 T2 C R T3 L S2 C R T R S B K _ T2 C L T2 R S2 F S"],
  // ---------- Monde 5 : Néon (ponts, turbos, vitesse) ----------
  [4, "E01 · Néon", "S B S3 C R S2 R S B S3 C L S2 F S"],
  [4, "E02 · Échangeur", "S2 U S3 R S2 R S2 R S D S C L S3 F S"],
  [4, "E03 · Hyperdrive", "S B S B S2 C R S2 R S B K _ S2 C L S2 R S2 F S"],
  [4, "E04 · Tour", "S2 U U S R S2 R S2 R S C L S2 D D C L S3 F S"],
  [4, "E05 · Finale", "S B S3 C U S2 R S3 R S D C L S B K _ S2 R S3 C R S2 L S B S2 F S"],
];

// Médailles : auteur < or < argent < bronze (proportionnelles au temps auteur)
export const MEDALS = [
  { id: "author", label: "Auteur", color: "#3fd06b", k: 1 },
  { id: "gold", label: "Or", color: "#ffd23f", k: 1.08 },
  { id: "silver", label: "Argent", color: "#cfd8e3", k: 1.22 },
  { id: "bronze", label: "Bronze", color: "#d08a4a", k: 1.45 },
];
export const medalTimes = (author) => MEDALS.map((m) => ({ ...m, ms: Math.ceil((author * m.k) / 10) * 10 }));
export function medalFor(ms, author) {
  if (ms == null || !author) return null;
  return medalTimes(author).find((m) => ms <= m.ms) || null;
}

import { AUTHOR } from "./author-times.js";

export const OFFICIAL = RAW.map(([world, name, path], i) => {
  const id = `off-${world + 1}-${(i % 5) + 1}`;
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
