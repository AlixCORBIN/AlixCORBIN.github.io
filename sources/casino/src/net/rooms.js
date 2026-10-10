// Annuaire des salles publiques : présence Supabase Realtime sur un canal commun.
// L'hôte d'une salle publique s'y « présente » ; le hub liste ce qui est présent.
// Rien en base : une salle disparaît toute seule quand l'hôte ferme sa page.
import { supabase } from "../lib/supabase.js";

const TOPIC = "casino-rooms";
let ch = null;
let ready = null;

function channel() {
  if (!ch) {
    ch = supabase.channel(TOPIC, { config: { presence: { key: "h-" + Math.random().toString(36).slice(2) } } });
    ready = new Promise((resolve) => ch.subscribe((s) => s === "SUBSCRIBED" && resolve()));
  }
  return ch;
}

let last = "";
export async function announceRoom(info) {
  const sig = JSON.stringify(info);
  if (sig === last) return;
  last = sig;
  try {
    channel();
    await ready;
    await ch.track({ ...info, at: Date.now() });
  } catch {}
}

export async function withdrawRoom() {
  last = "";
  if (!ch) return;
  try { await ch.untrack(); } catch {}
  try { supabase.removeChannel(ch); } catch {}
  ch = null;
}

export function watchRooms(cb) {
  const w = supabase.channel(TOPIC, { config: { presence: { key: "w-" + Math.random().toString(36).slice(2) } } });
  const emit = () => {
    const list = Object.values(w.presenceState()).flat().filter((r) => r && r.public && r.code);
    const uniq = new Map(list.map((r) => [r.game + r.code, r]));
    cb([...uniq.values()].sort((a, b) => (b.at || 0) - (a.at || 0)));
  };
  w.on("presence", { event: "sync" }, emit).subscribe();
  return () => { try { supabase.removeChannel(w); } catch {} };
}

export const GAME_INFO = {
  blackjack: { title: "Blackjack", icon: "♠", max: 5 },
  roulette: { title: "Roulette", icon: "◉", max: 8 },
  werewolf: { title: "Loup-Garou", icon: "🐺", max: 16 },
  uno: { title: "UNO 3D", icon: "🃏", max: 10 },
  monopoly: { title: "Monopoly 3D", icon: "🎩", max: 8 },
};
