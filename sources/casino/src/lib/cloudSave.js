// Sauvegarde du Casino synchronisée avec le compte (facultatif).
// - Sans compte : tout reste dans le localStorage du navigateur, comme avant.
// - Avec compte : une save « active » par compte (user_save_active), partagée par tous
//   les navigateurs, + un instantané par navigateur (user_saves).
// - Quand un navigateur se connecte avec une save différente de celle du compte,
//   on demande laquelle garder (SaveChooser).
import { account } from "./mii.js";

const WALLET_KEY = "casino3d-wallet";
const PB_KEY = "racing-pb";
const CAR_KEY = "racing-car";
const DEVICE_KEY = "casino-device-id";
const LINK_KEY = "casino-save-link"; // { uid, at } : save locale déjà rattachée à ce compte
const PUSH_MS = 1500;
const POLL_MS = 20000;

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  json(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } },
};

function deviceId() {
  let id = ls.get(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); ls.set(DEVICE_KEY, id); }
  return id;
}
function deviceLabel() {
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows"
    : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} · ${os}` : b;
}

/* ---------- contenu d'une save ---------- */

// Les fantômes de course sont lourds et déjà stockés en ligne : on ne synchronise que les temps.
export function readLocal() {
  const w = ls.json(WALLET_KEY, {});
  const pbs = {};
  for (const [map, pb] of Object.entries(ls.json(PB_KEY, {}))) if (pb?.ms) pbs[map] = { ms: pb.ms, splits: pb.splits };
  return {
    v: 1,
    wallet: {
      bankroll: Number.isFinite(w.bankroll) ? Math.max(0, Math.floor(w.bankroll)) : 1000,
      debt: Math.max(0, Math.floor(w.debt || 0)),
      name: w.name || "",
    },
    racing: { pbs, car: ls.get(CAR_KEY) || null },
  };
}
const sameData = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isFresh = (s) => s.wallet.bankroll === 1000 && !s.wallet.debt && !s.wallet.name && !Object.keys(s.racing.pbs).length;

function applyLocal(s) {
  const w = ls.json(WALLET_KEY, {});
  ls.set(WALLET_KEY, JSON.stringify({ ...w, ...s.wallet }));
  // records : on garde le meilleur des deux (et le fantôme local quand il correspond)
  const local = ls.json(PB_KEY, {});
  for (const [map, pb] of Object.entries(s.racing?.pbs || {})) {
    if (!local[map] || pb.ms < local[map].ms) local[map] = { ms: pb.ms, splits: pb.splits };
  }
  ls.set(PB_KEY, JSON.stringify(local));
  if (s.racing?.car) ls.set(CAR_KEY, s.racing.car);
  window.dispatchEvent(new Event("casino-save"));
}

export function summarize(s) {
  return {
    bankroll: s.wallet.bankroll,
    debt: s.wallet.debt,
    name: s.wallet.name,
    records: Object.keys(s.racing?.pbs || {}).length,
  };
}

/* ---------- état observable (pour le popup) ---------- */

let state = { status: "local", choices: null }; // status : local | syncing | synced | error
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); };
export const cloudSave = {
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  get: () => state,
  choose: (c) => choose(c),
};

/* ---------- synchronisation ---------- */

let uid = null;
let lastPushed = null;
let pushTimer = null;
let canApply = true; // pas d'application d'une save distante en pleine partie
export const setCanApply = (v) => { canApply = v; };

const sb = () => account.sb;
const link = () => ls.json(LINK_KEY, null);

async function pushNow() {
  if (!uid || state.choices) return;
  const data = readLocal();
  if (lastPushed && sameData(data, lastPushed)) return;
  const at = new Date().toISOString();
  const [a, d] = await Promise.all([
    sb().from("user_save_active").upsert({ user_id: uid, data, source_device: deviceId(), updated_at: at }),
    sb().from("user_saves").upsert({ user_id: uid, device_id: deviceId(), label: deviceLabel(), data, updated_at: at }),
  ]);
  if (a.error || d.error) { set({ status: "error" }); return; }
  lastPushed = data;
  ls.set(LINK_KEY, JSON.stringify({ uid, at }));
  set({ status: "synced" });
}
// appelé après chaque écriture locale (wallet, records…) : envoi groupé
export function notifyLocalChange() {
  if (!uid) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow().catch(() => set({ status: "error" })), PUSH_MS);
}

async function pull() {
  if (!uid || state.choices || !canApply) return;
  const { data: row } = await sb().from("user_save_active").select("data,updated_at").maybeSingle();
  const l = link();
  if (!row || !l || l.uid !== uid) return;
  const local = readLocal();
  if (lastPushed && !sameData(local, lastPushed)) return pushNow(); // modif locale en attente : elle gagne
  if (new Date(row.updated_at) > new Date(l.at) && !sameData(row.data, local)) {
    applyLocal(row.data);
    lastPushed = readLocal();
    ls.set(LINK_KEY, JSON.stringify({ uid, at: row.updated_at }));
  }
}

async function onLogin(id) {
  uid = id;
  set({ status: "syncing" });
  const [act, devs] = await Promise.all([
    sb().from("user_save_active").select("data,updated_at,source_device").maybeSingle(),
    sb().from("user_saves").select("device_id,label,data,updated_at").order("updated_at", { ascending: false }),
  ]);
  if (act.error || devs.error) { set({ status: "error" }); return; }
  const local = readLocal();
  const l = link();
  const active = act.data;

  // navigateur déjà rattaché à ce compte : on suit simplement la save du compte
  if (l?.uid === id && active) {
    if (!sameData(active.data, local) && canApply) applyLocal(active.data);
    lastPushed = readLocal();
    ls.set(LINK_KEY, JSON.stringify({ uid: id, at: active.updated_at }));
    set({ status: "synced" });
    return;
  }

  // sinon : save du compte ou save de ce navigateur ? (les instantanés des autres navigateurs
  // déjà rattachés ne sont que des copies de la save du compte : servent de sauvegarde, pas de choix)
  const choices = [];
  const add = (c) => { if (!choices.some((x) => sameData(x.data, c.data))) choices.push(c); };
  if (active) {
    const from = (devs.data || []).find((d) => d.device_id === active.source_device);
    add({ key: "account", label: `Sauvegarde du compte${from?.label ? ` (${from.label})` : ""}`, at: active.updated_at, data: active.data });
  }
  if (!isFresh(local)) add({ key: "local", label: `Ce navigateur (${deviceLabel()})`, at: null, data: local });
  if (choices.length <= 1) return choose(choices[0] || { key: "local", data: local });
  set({ status: "syncing", choices });
}

async function choose(c) {
  if (c.key !== "local") applyLocal(c.data);
  set({ choices: null });
  lastPushed = null;
  await pushNow();
}

function onLogout() {
  uid = null;
  lastPushed = null;
  clearTimeout(pushTimer);
  ls.set(LINK_KEY, "null");
  set({ status: "local", choices: null });
}

let started = false;
export function startCloudSave() {
  if (started || !account) return;
  started = true;
  const handle = (u) => (u ? onLogin(u.id) : onLogout()).catch(() => set({ status: "error" }));
  account.ready.then((u) => u && handle(u));
  account.onChange((u, event) => { if (event !== "INIT" && (u?.id || null) !== uid) handle(u); });
  // filet de sécurité : envoie les modifs locales non signalées et récupère celles des autres navigateurs
  setInterval(() => { if (uid) pull().catch(() => {}); }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!uid) return;
    if (document.hidden) pushNow().catch(() => {});
    else pull().catch(() => {});
  });
}
