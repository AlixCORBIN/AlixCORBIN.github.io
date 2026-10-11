// IA des bots (et du Croupier) : une action à la fois, comme un joueur.
// Elle compte les cartouches restantes et n'utilise que ce qu'elle a appris (loupe, téléphone).
import { secureRandomInt } from "../../lib/random.js";

const chance = (p) => secureRandomInt(1000) < p * 1000;
const speed = () => (import.meta.env?.DEV && globalThis.__bsSpeed) || 1;
export const botDelay = (min, max) => (min + secureRandomInt(Math.max(1, max - min))) / speed();

export function botTurn(g, bot) {
  const has = (it) => bot.items.indexOf(it);
  const use = (it, extra = {}) => ({ t: "item", idx: has(it), ...extra });
  const cur = g.shells[0];
  const live = g.shells.filter((s) => s.live).length;
  const blank = g.shells.length - live;
  let known = g.know[bot.id]?.[cur.id];
  if (known === undefined) known = live === 0 ? false : blank === 0 ? true : null;

  const others = g.players.filter((p) => p.alive && p !== bot);
  const low = Math.min(...others.map((p) => p.hp));
  const weakest = others.filter((p) => p.hp === low);
  const target = weakest[secureRandomInt(weakest.length)];
  const canHeal = !bot.cut && bot.hp < bot.maxHp;

  // 1. se soigner
  if (canHeal && has("cigarettes") >= 0) return use("cigarettes");
  if (!bot.cut && bot.hp >= 2 && bot.hp <= bot.maxHp - 2 && has("medicament") >= 0 && chance(0.5)) return use("medicament");

  // 2. s'informer
  if (known === null && has("loupe") >= 0) return use("loupe");
  if (known === null && g.shells.length > 2 && has("telephone") >= 0 && chance(0.5)) return use("telephone");

  // 3. voler ce qui sert maintenant
  if (has("adrenaline") >= 0) {
    const wanted = known === null ? ["loupe"] : known && !g.saw ? ["scie"] : canHeal ? ["cigarettes"] : [];
    for (const it of wanted) {
      const victim = others.find((p) => p.items.includes(it));
      if (victim) return use("adrenaline", { target: victim.id, steal: victim.items.indexOf(it) });
    }
  }
  if (has("telecommande") >= 0 && others.length >= 2 && chance(0.25)) return use("telecommande");

  const cuff = has("menottes") >= 0 && !target.cuffed && chance(0.85);

  // 4. cartouche connue
  if (known === true) {
    if (!g.saw && has("scie") >= 0) return use("scie");
    if (cuff) return use("menottes", { target: target.id });
    return { t: "shoot", target: target.id };
  }
  if (known === false) {
    if (has("inverseur") >= 0) return use("inverseur");
    if (has("biere") >= 0 && chance(0.7)) return use("biere");
    return { t: "shoot", target: bot.id };
  }

  // 5. à l'aveugle : probabilité que la cartouche soit réelle
  const p = live / g.shells.length;
  if (p > 0.5 || (p === 0.5 && chance(0.7))) {
    if (cuff) return use("menottes", { target: target.id });
    if (p >= 0.75 && !g.saw && has("scie") >= 0) return use("scie");
    return { t: "shoot", target: target.id };
  }
  if (has("biere") >= 0 && chance(0.3)) return use("biere");
  return { t: "shoot", target: bot.id };
}
