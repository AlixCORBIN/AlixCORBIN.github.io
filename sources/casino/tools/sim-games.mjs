// Parties complètes jouées uniquement par des bots, en accéléré, pour chaque jeu de société.
// Vérifie : pas d'exception, pas de blocage, fin de partie atteinte, résultat valide pour report_game.
// Lancer : npx vite-node tools/sim-games.mjs [jeu] [nombre]
import FakeTimers from "@sinonjs/fake-timers";

const clock = FakeTimers.install({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.fetch = () => Promise.reject(new Error("hors ligne (simulation)"));

const { setActiveHost } = await import("/src/lib/report.js");
const GAMES = {
  uno: { mod: "/src/games/uno/host.js", cls: "UnoHost", bots: 3, api: "/src/games/uno/api.js", save: "saveUnoGame" },
  werewolf: { mod: "/src/games/werewolf/host.js", cls: "WerewolfHost", bots: 6, api: "/src/games/werewolf/api.js", save: "saveWerewolfGame" },
  buckshot: { mod: "/src/games/buckshot/host.js", cls: "BuckshotHost", bots: 2, api: "/src/games/buckshot/api.js", save: "saveBuckshotGame" },
  milleborne: { mod: "/src/games/milleborne/host.js", cls: "MilleBorneHost", bots: 3, api: "/src/games/milleborne/api.js", save: "saveMilleBornesGame" },
  horses: { mod: "/src/games/horses/host.js", cls: "HorsesHost", bots: 3, api: "/src/games/horses/api.js", save: "saveHorsesGame" },
  naval: { mod: "/src/games/naval/host.js", cls: "NavalHost", bots: 1, api: "/src/games/naval/api.js", save: "saveNavalGame" },
  connect4: { mod: "/src/games/connect4/host.js", cls: "Connect4Host", bots: 1, api: "/src/games/connect4/api.js", save: "saveConnect4Game" },
};

const only = process.argv[2] && process.argv[2] !== "all" ? [process.argv[2]] : Object.keys(GAMES);
const runs = Number(process.argv[3] || 5);
const results = [];

for (const name of only) {
  const cfg = GAMES[name];
  const Host = (await import(cfg.mod))[cfg.cls];
  const api = await import(cfg.api);
  const stats = { game: name, ok: 0, stalled: 0, errors: [], reports: [], minutes: [] };
  for (let i = 0; i < runs; i++) {
    const errs = [];
    const origErr = console.error, origWarn = console.warn;
    console.error = (...a) => errs.push(a.map(String).join(" ").slice(0, 200));
    console.warn = () => {};
    try {
      const h = new Host("Testeur", { online: false, game: name });
      for (let b = 0; b < cfg.bots; b++) h.act({ t: "addBot" });
      h.act({ t: "start" });
      // le joueur « humain » est joué lui aussi par l'IA des bots
      const human = h.g.players.find((p) => !p.bot);
      if (human) human.bot = true;
      h.publish();
      const t0 = Date.now();
      let guard = 0;
      while (h.g.phase !== "end" && Date.now() - t0 < 3 * 3600e3 && guard++ < 200000) await clock.tickAsync(250);
      const minutes = Math.round((Date.now() - t0) / 60000);
      if (h.g.phase !== "end") {
        stats.stalled++;
        errs.push(`bloqué en phase ${h.g.phase} après ${minutes} min simulées`);
      } else {
        stats.ok++;
        stats.minutes.push(minutes);
        // résultat tel qu'il serait confirmé par les humains
        if (human) human.bot = false;
        let captured = null;
        setActiveHost({ setReport: (game, args) => { captured = { game, args }; } });
        await api[cfg.save](h.g);
        setActiveHost(null);
        if (!captured) errs.push("aucun résultat produit en fin de partie");
        else stats.reports.push(captured);
      }
      h.destroy?.();
    } catch (e) {
      errs.push("EXCEPTION " + (e.stack || e).toString().split("\n").slice(0, 3).join(" | "));
    }
    console.error = origErr;
    console.warn = origWarn;
    stats.errors.push(...errs);
  }
  results.push(stats);
  const uniq = [...new Set(stats.errors)];
  console.log(`${name.padEnd(11)} terminées ${stats.ok}/${runs}  bloquées ${stats.stalled}  durée moy ${stats.minutes.length ? Math.round(stats.minutes.reduce((a, b) => a + b) / stats.minutes.length) : "-"} min  erreurs ${uniq.length}`);
  uniq.slice(0, 6).forEach((e) => console.log("    · " + e));
}
const fs = await import("node:fs");
fs.writeFileSync("/tmp/sim-reports.json", JSON.stringify(results.map((r) => ({ game: r.game, reports: r.reports.slice(0, 2) })), null, 1));
clock.uninstall();
process.exit(0);
