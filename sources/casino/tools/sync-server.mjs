// Copie le code de jeu partagé dans les Edge Functions (Supabase ne déploie que le dossier de la fonction).
// node tools/sync-server.mjs  — à relancer après toute modification d'un moteur.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const FN = fileURLToPath(new URL("../supabase/functions/", import.meta.url));

const RANDOM_SHIM = `// Version serveur de lib/random.js (CSPRNG uniquement ; random.org est fourni par la fonction)
export function secureRandomInt(max) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(4294967296 / max) * max;
  let v;
  do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
  return v % max;
}
`;

const TARGETS = {
  "casino-table": [
    "server/tables.js",
    "games/blackjack/engine.js",
    "games/blackjack/cards.js",
    "games/roulette/engine.js",
    "games/roulette/rules.js",
    "lib/result.js",
  ],
  "racing-verify": [
    "server/replay.js",
    "games/racing/physics.js",
    "games/racing/blocks.js",
    "games/racing/terrain.js",
    "games/racing/track.js",
    "games/racing/maps.js",
    "games/racing/author-times.js",
  ],
};

for (const [fn, files] of Object.entries(TARGETS)) {
  const lib = join(FN, fn, "_lib");
  rmSync(lib, { recursive: true, force: true });
  for (const f of files) {
    mkdirSync(dirname(join(lib, f)), { recursive: true });
    cpSync(join(SRC, f), join(lib, f));
  }
  mkdirSync(join(lib, "lib"), { recursive: true });
  writeFileSync(join(lib, "lib/random.js"), RANDOM_SHIM);
  console.log(fn, "←", files.length, "fichiers");
}
