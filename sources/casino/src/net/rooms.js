// Annuaire des salles publiques : présence Supabase Realtime sur un canal commun.
// L'hôte d'une salle publique s'y « présente » ; le hub liste ce qui est présent.
// Rien en base : une salle disparaît toute seule quand l'hôte ferme sa page.
import { supabase } from "../lib/supabase.js";

const TOPIC = "casino-rooms";
// Un seul canal pour tout l'onglet : supabase.channel(TOPIC) renvoie le canal existant
// s'il y en a déjà un. Avant, le hub et l'hôte créaient chacun le leur : en revenant
// au hub, on récupérait le canal déjà abonné de l'hôte et .on("presence") plantait
// (écran noir au retour d'un jeu en salle publique).
let ch = null;
let ready = null;
let subscribed = false;
let rooms = [];
const watchers = new Set();

function readRooms() {
  const list = Object.values(ch.presenceState()).flat().filter((r) => r && r.public && r.code);
  const uniq = new Map(list.map((r) => [r.game + r.code, r]));
  return [...uniq.values()].sort((a, b) => (b.at || 0) - (a.at || 0));
}

function channel() {
  if (!ch) {
    ch = supabase.channel(TOPIC, { config: { presence: { key: "c-" + Math.random().toString(36).slice(2) } } });
    ch.on("presence", { event: "sync" }, () => {
      rooms = readRooms();
      watchers.forEach((cb) => cb(rooms));
    });
    ready = new Promise((resolve) =>
      ch.subscribe((s) => {
        if (s === "SUBSCRIBED") {
          subscribed = true;
          resolve();
        }
      }),
    );
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
}

export function watchRooms(cb) {
  try {
    channel();
  } catch {
    return () => {};
  }
  watchers.add(cb);
  if (subscribed) cb(rooms);
  return () => watchers.delete(cb);
}

export const GAME_INFO = {
  blackjack: { title: "Blackjack", icon: "♠", max: 5 },
  roulette: { title: "Roulette", icon: "◉", max: 8 },
  werewolf: { title: "Loup-Garou", icon: "🐺", max: 16 },
  uno: { title: "UNO 3D", icon: "🃏", max: 10 },
  monopoly: { title: "Monopoly 3D", icon: "🎩", max: 8 },
};
