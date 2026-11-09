// Icônes Papicons (MIT, voir /icons/LICENSE), SVG d'origine en ligne, couleur héritée du texte
const RAW = import.meta.glob("../../../../icons/*.svg", { query: "?raw", import: "default", eager: true });
const SVG = {};
for (const [path, src] of Object.entries(RAW)) {
  const name = path.split("/").pop().replace(".svg", "");
  SVG[name] = src.replace(/fill="(black|#000)"/g, 'fill="currentColor"').replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
}

export default function Icon({ name }) {
  const s = SVG[name];
  return s ? <span className="ic" dangerouslySetInnerHTML={{ __html: s }} /> : null;
}

// Texte qui peut contenir des emoji (messages de partie, rôles, objets) : chaque emoji devient son icône Papicons
import { EMOJI } from "./emoji-map.js";
const EMOJI_RE = new RegExp("(" + Object.keys(EMOJI).sort((a, b) => b.length - a.length).map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")️?", "gu");
export function rich(text) {
  if (typeof text !== "string") return text;
  const parts = text.split(EMOJI_RE);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 ? <Icon key={i} name={EMOJI[p] || EMOJI[p + "️"]} /> : p));
}
