// Test rapide des tables serveur : node tools/test-tables.mjs
import * as T from "../src/server/tables.js";
let now = 1_000_000;
const ok = (c, m) => { if (!c) { console.error("ECHEC:", m); process.exitCode = 1; } else console.log("ok -", m); };

// Blackjack solo
const bj = T.createRoom("blackjack", "AAAAA");
T.join(bj, "u1", "Alix", 1000, null, now, "s1");
ok(!T.act(bj, "u1", { t: "bet", bet: 5000 }, now).ok, "mise au-dela du solde refusee");
ok(T.act(bj, "u1", { t: "bet", bet: 100 }, now).ok, "mise 100");
ok(T.act(bj, "u1", { t: "ready" }, now).ok, "pret");
for (let i = 0; i < 30 && bj.g.phase !== "settle"; i++) {
  if (bj.g.phase === "insurance") T.act(bj, "u1", { t: "insurance", take: false }, now);
  else if (bj.g.phase === "playing") T.act(bj, "u1", { t: "stand" }, now);
  now += 1100; T.tick(bj, now);
}
ok(bj.g.phase === "settle", "manche reglee (phase " + bj.g.phase + ")");
const w = T.walletUpdates(bj)[0];
ok([900, 1000, 1100, 1150].includes(w.bankroll), "solde coherent " + w.bankroll);
ok(!T.act(bj, "u2", { t: "bet", bet: 1 }, now).ok, "intrus refuse");
const v = T.view(bj, now);
ok(!("shoe" in v) && !("nextKeys" in v), "sabot cache");
now += 9100; T.tick(bj, now);
ok(bj.g.phase === "betting", "manche suivante auto");

// Roulette multi : cycle automatique 30 s
const ro = T.createRoom("roulette", "BBBBB");
T.join(ro, "a", "A", 1000, null, now, "sa"); T.join(ro, "b", "B", 1000, null, now, "sb");
ok(T.act(ro, "a", { t: "bet", key: "straight:17", amount: 100 }, now).ok, "mise roulette");
ok(!T.act(ro, "a", { t: "ready" }, now).ok, "pret interdit en multi");
ok(T.walletUpdates(ro).find((x) => x.uid === "a").bankroll === 1000 && ro.g.players[0].bankroll === 900, "mise rendue tant que modifiable");
now += 30001; T.tick(ro, now);
ok(ro.g.phase === "spinning", "tirage auto");
now += 9001; T.tick(ro, now);
ok(ro.g.phase === "settle" && ro.spins.length === 1, "resultat " + ro.g.result);
now += 25000; T.join(ro, "a", "A", 0, null, now); T.dropStale(ro, now);
ok(ro.g.players.find((p) => p.id === "b")?.left && !ro.members.b, "joueur inactif retire");
// credit
const bj2 = T.createRoom("blackjack", "CCCCC"); T.join(bj2, "z", "Z", 0, null, now, "sz");
ok(T.act(bj2, "z", { t: "credit" }, now).ok, "credit");
const u = T.walletUpdates(bj2)[0]; ok(u.bankroll === 500 && u.debt === 500, "credit -> dette");
ok(T.walletUpdates(bj2)[0].debt === 0, "dette comptee une seule fois");
