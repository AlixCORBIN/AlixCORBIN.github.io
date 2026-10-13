// Rôle admin, toujours vérifié par le serveur (table admins, fonctions is_admin / public_admins).
// - pseudo rouge : le pseudo est réservé côté serveur (wallets), donc un pseudo admin ne peut pas être repris.
// - en salle : un joueur n'est admin que si son uid est garanti par le serveur (tables serveur)
//   ou s'il présente un badge signé que le serveur valide (parties pair-à-pair).
import React from "react";
import { account } from "./mii.js";

let uids = new Set();
let pseudos = new Set();
let roomAdmins = new Set();
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

let loading = null;
export function loadAdmins() {
  if (!account) return Promise.resolve();
  loading ||= Promise.resolve(account.sb.rpc("public_admins")).then(({ data }) => {
    uids = new Set((data || []).map((r) => r.uid));
    pseudos = new Set((data || []).map((r) => (r.pseudo || "").toLowerCase()).filter(Boolean));
    emit();
  }, () => { loading = null; });
  return loading;
}
loadAdmins();

export const isAdminUid = (uid) => !!uid && uids.has(uid);
export const isAdminName = (name) => !!name && pseudos.has(String(name).trim().toLowerCase());

// Joueurs admin vérifiés dans la salle courante (id de joueur)
export function setRoomAdmins(ids) {
  roomAdmins = new Set(ids);
  emit();
}
export const isRoomAdmin = (id) => roomAdmins.has(id);

// Abonnement React : se met à jour quand la liste ou la salle change
let ver = 0;
listeners.add(() => ver++);
export function useAdmins() {
  React.useSyncExternalStore(subscribe, () => ver);
  return { isAdminName, isAdminUid, isRoomAdmin };
}

// Style du pseudo : rouge pour un admin hors salle (pseudo réservé) ou vérifié en salle
export const ADMIN_RED = "#ff3b3b";
export function nameStyle(name, playerId) {
  const admin = playerId != null ? isRoomAdmin(playerId) : isAdminName(name);
  return admin ? { color: ADMIN_RED, fontWeight: 700 } : undefined;
}
export function AdminName({ name, id, children }) {
  useAdmins();
  return React.createElement("span", { style: nameStyle(name, id) }, children ?? name);
}

// Badge signé par le serveur, lié à "SALLE:idJoueur" : un autre joueur ne peut pas le réutiliser
const badges = new Map();
export async function myBadge(scope) {
  if (!account || !scope) return null;
  const c = badges.get(scope);
  if (c && c.exp > Date.now() / 1000 + 600) return c.token;
  const { data } = await account.sb.rpc("admin_room_badge", { p_scope: scope });
  if (!data) return null;
  badges.set(scope, { token: data, exp: Number(String(data).split(".")[1]) || 0 });
  return data;
}

const verified = new Map();
// Renvoie l'uid admin garanti par le serveur pour cette portée, ou null
export function verifyBadge(token, scope) {
  if (!account || typeof token !== "string" || token.length > 200 || !scope) return Promise.resolve(null);
  const k = scope + "|" + token;
  if (!verified.has(k)) {
    verified.set(k, Promise.resolve(account.sb.rpc("verify_admin_room_badge", { p_token: token, p_scope: scope })).then(({ data }) => data || null, () => null));
  }
  return verified.get(k);
}
