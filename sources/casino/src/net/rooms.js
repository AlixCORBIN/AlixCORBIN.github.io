// Annuaire des salles publiques : présence Supabase Realtime sur un canal commun.
// L'hôte d'une salle publique s'y « présente » ; le hub liste ce qui est présent.
// Rien en base : une salle disparaît toute seule quand l'hôte ferme sa page.
import { supabase } from "../lib/supabase.js";
import { isAdminName, loadAdmins, verifyBadge } from "../lib/admins.js";

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

// Tables d'argent tenues par le serveur : listées depuis casino_room_views
let serverRooms = [];
let poll = null;
async function loadServerRooms() {
  try {
    const since = new Date(Date.now() - 120000).toISOString();
    const { data } = await supabase.from("casino_room_views").select("code, game, players, view, updated_at")
      .eq("is_public", true).gt("players", 0).gt("updated_at", since).limit(30);
    serverRooms = (data || []).map((r) => ({
      public: true, game: r.game, code: r.code, players: r.players, bots: 0,
      host: r.view?.players?.[0]?.name || "Table", server: true, status: "playing", at: Date.parse(r.updated_at),
    }));
  } catch {}
  rooms = readRooms();
  watchers.forEach((cb) => cb(rooms));
}

// Hôte admin : pseudo réservé côté serveur (tables serveur) ou badge signé lié à la salle (pair-à-pair)
const okBadges = new Set();
const checking = new Set();
function readRooms() {
  const list = [...Object.values(ch?.presenceState() || {}).flat(), ...serverRooms].filter((r) => r && r.public && r.code);
  const uniq = new Map(list.map((r) => [r.game + r.code, r]));
  for (const r of uniq.values()) {
    if (r.server || !r.badge || okBadges.has(r.badge) || checking.has(r.badge)) continue;
    checking.add(r.badge);
    verifyBadge(r.badge, `${r.code}:${r.hostId}`).then((u) => {
      if (!u) return;
      okBadges.add(r.badge);
      rooms = readRooms();
      watchers.forEach((cb) => cb(rooms));
    });
  }
  return [...uniq.values()]
    .map((r) => ({ ...r, adminHost: r.server ? isAdminName(r.host) : okBadges.has(r.badge) }))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}
loadAdmins();

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
  if (!poll) {
    loadServerRooms();
    poll = setInterval(loadServerRooms, 10000);
  }
  return () => {
    watchers.delete(cb);
    if (!watchers.size) {
      clearInterval(poll);
      poll = null;
    }
  };
}

export const GAME_INFO = {
  blackjack: { title: "Blackjack", icon: "♠", max: 5 },
  roulette: { title: "Roulette", icon: "◉", max: 8 },
  werewolf: { title: "Loup-Garou", icon: "🐺", max: 16 },
  uno: { title: "UNO 3D", icon: "🃏", max: 10 },
  milleborne: { title: "Mille Bornes", icon: "🚗", max: 6 },
  naval: { title: "Bataille navale", icon: "⚓", max: 2 },
  connect4: { title: "Puissance 4", icon: "🔴", max: 2 },
  horses: { title: "Petits Chevaux", icon: "🐴", max: 4 },
  buckshot: { title: "Buckshot", icon: "☠", max: 4 },
  monopoly: { title: "Monopoly 3D", icon: "🎩", max: 8 },
};
