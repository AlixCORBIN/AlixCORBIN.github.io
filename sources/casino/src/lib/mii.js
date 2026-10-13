// Pont entre le Casino et la chaîne Mii du portfolio (../../mii/lib, alias @mii).
// Le Casino lit le même stockage que l'éditeur et la même session de compte.
import React from "react";
import * as THREE from "three";
import { createClient } from "@supabase/supabase-js";
import { createMiiKit } from "@mii/mii-three.js";
import { GUEST_MIIS, isGuestMii, miiForId, sanitizeMii, sanitizeOwnMii } from "@mii/mii-core.js";
import { attachAccount, getMainSync, listSync, miiStore } from "@mii/mii-store.js";
import { createAccount } from "@mii/account.js";

export const miiKit = createMiiKit(THREE);
export { getMainSync, listSync, miiStore, miiForId, sanitizeMii, sanitizeOwnMii, GUEST_MIIS, isGuestMii };

export let account = null;
try {
  account = createAccount(createClient);
  attachAccount(account);
} catch {
  account = null;
}

/* ---------- Mii choisi pour jouer ----------
   Ordre : le dernier choisi, sinon « Mon Mii » de la chaîne Mii, sinon un Mii invité
   (tiré au hasard une fois puis gardé), pour pouvoir jouer sans compte ni création. */
const PICK_KEY = "casino-mii";
export function loadPlayMii() {
  const all = [...listSync(), ...GUEST_MIIS];
  let id = null;
  try { id = localStorage.getItem(PICK_KEY); } catch {}
  const picked = all.find((m) => m.id === id) || getMainSync();
  if (picked) return picked;
  const g = GUEST_MIIS[Math.floor(Math.random() * GUEST_MIIS.length)];
  savePlayMii(g.id);
  return g;
}
export function savePlayMii(id) {
  try { localStorage.setItem(PICK_KEY, id || ""); } catch {}
}

/* ---------- Mii des joueurs de la salle (diffusés par l'hôte) ---------- */
let roomMiis = {};
const listeners = new Set();
export function setRoomMiis(map) {
  roomMiis = map || {};
  listeners.forEach((fn) => fn());
}
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
// Mii d'un joueur : celui envoyé par l'hôte, sinon un Mii stable tiré de son id (bots)
export function useRoomMii(p) {
  const map = React.useSyncExternalStore(subscribe, () => roomMiis);
  const sent = map[p.id];
  return React.useMemo(() => sent || miiForId(p.id, p.name), [sent, p.id, p.name]);
}
