// Records et maps de la communauté (RPC Supabase, voir supabase/racing.sql)
import { supabase } from "../../lib/supabase.js";
import { callFunction, rpc } from "../../lib/identity.js";

const PB_KEY = "racing-pb";

export function loadPBs() {
  try { return JSON.parse(localStorage.getItem(PB_KEY) || "{}"); } catch { return {}; }
}
export function localPB(mapId) {
  return loadPBs()[mapId] || null;
}
function savePB(mapId, ms, ghost, splits) {
  try {
    const all = loadPBs();
    all[mapId] = { ms, ghost, splits };
    localStorage.setItem(PB_KEY, JSON.stringify(all));
  } catch {
    // quota : on garde au moins le temps
    try {
      const all = loadPBs();
      all[mapId] = { ms };
      localStorage.setItem(PB_KEY, JSON.stringify(all));
    } catch {}
  }
}

// Record perso local : synced = false si le serveur ne l'a pas accepté (il n'est alors pas au classement)
function markSynced(mapId, ms, ok) {
  try {
    const all = loadPBs();
    if (all[mapId] && all[mapId].ms === ms) {
      all[mapId].synced = ok;
      localStorage.setItem(PB_KEY, JSON.stringify(all));
    }
  } catch {}
}

// Enregistre automatiquement chaque arrivée. Retourne { pb, rank }.
// Le temps en ligne n'est pas celui du navigateur : le serveur rejoue les entrées (log)
// et calcule lui-même le temps et le fantôme (Edge Function racing-verify). Le pseudo
// enregistré est celui réservé par le compte.
export async function submitTime(mapId, pseudo, ms, ghost, splits, log) {
  const prev = localPB(mapId);
  const pb = !prev || ms < prev.ms;
  if (pb) savePB(mapId, ms, ghost, splits);
  if (!pseudo || pseudo === "Joueur" || !log) return { pb, rank: null };
  try {
    const res = await callFunction("racing-verify", { map: mapId, ms, log });
    if (res.error) console.warn("racing-verify", res.error);
    if (pb) markSynced(mapId, ms, !res.error);
    return { pb, rank: res.rank ?? null, rejected: res.error || null };
  } catch (e) {
    console.warn("racing-verify", e.message);
    if (pb) markSynced(mapId, ms, false);
    return { pb, rank: null, rejected: e.message };
  }
}

export async function leaderboard(mapId, limit = 100) {
  const { data, error } = await supabase.rpc("racing_leaderboard", { p_map: mapId, p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function fetchGhost(mapId, pseudo) {
  const { data, error } = await supabase.rpc("racing_ghost", { p_map: mapId, p_pseudo: pseudo });
  if (error) return null;
  return Array.isArray(data) ? data : null;
}

export async function worldRecords(ids) {
  const { data, error } = await supabase.rpc("racing_wrs", { p_maps: ids });
  if (error) return {};
  return Object.fromEntries((data || []).map((r) => [r.map_id, r]));
}

export async function listMaps(search = "") {
  const { data, error } = await supabase.rpc("racing_list_maps", { p_search: search, p_limit: 60 });
  if (error) throw error;
  return data || [];
}

export async function getMap(id) {
  const { data, error } = await supabase.rpc("racing_get_map", { p_id: id });
  if (error) throw error;
  return data?.[0] || null;
}

export async function publishMap(name, author, data, authorTime) {
  const { data: id, error } = await supabase.rpc("racing_publish_map", { p_name: name, p_author: author, p_data: data, p_author_time: authorTime });
  if (error) throw error;
  if (!id) throw new Error("Map refusée (nom, taille ou temps invalide).");
  return id;
}

// ---------- Campagne par saison (voir supabase/racing-season2.sql) ----------
// Maps visibles de la saison (la RLS cache celles qui ne sont pas encore ouvertes, sauf aux admins)
export async function campaignList(season) {
  // client authentifié : sinon la RLS ne sait pas que le joueur est admin
  return (await rpc("racing_campaign_list", { p_season: season })) || [];
}

// Le compte connecté est-il admin ? (vérifié par le serveur ; false si la fonction n'existe pas)
export async function amIAdmin() {
  try {
    return (await rpc("is_admin")) === true;
  } catch { return false; }
}

// La saison est-elle ouverte à tous ? (publiée, ou date de début passée)
export async function seasonLive(id) {
  try {
    const { data, error } = await supabase.rpc("season_live", { p_id: id });
    return !error && data === true;
  } catch { return false; }
}

// Admin : envoie une map dans la campagne (refusé côté serveur si le compte n'est pas admin).
// meta = repères anti-triche de la map (trackMeta de meta.js), lus par racing_ghost_problem.
export async function adminCampaignUpsert({ mapId, seasonId, ord, name, data, authorMs, startsAt = null, meta }) {
  await rpc("admin_campaign_upsert", {
    p_map_id: mapId, p_season_id: seasonId, p_ord: ord, p_name: name, p_data: data, p_author_ms: authorMs, p_starts_at: startsAt, p_meta: meta,
  });
}

// Brouillons de l'éditeur (local)
const DRAFT_KEY = "racing-drafts";
export function loadDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]"); } catch { return []; }
}
export function saveDraft(d) {
  try {
    const all = loadDrafts().filter((x) => x.id !== d.id);
    all.unshift({ ...d, savedAt: Date.now() });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(all.slice(0, 30)));
  } catch {}
}
export function deleteDraft(id) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(loadDrafts().filter((x) => x.id !== id))); } catch {}
}

// Tous mes temps (rang, record du monde de chaque map)
export async function playerRecords(pseudo) {
  const { data, error } = await supabase.rpc("racing_player_records", { p_pseudo: pseudo });
  if (error) throw error;
  return data || [];
}

// Records du monde qu'on m'a pris depuis `since` (ISO) ; null = 30 derniers jours
export async function lostRecords(pseudo, since) {
  const { data, error } = await supabase.rpc("racing_notifications", { p_pseudo: pseudo, p_since: since });
  if (error) return [];
  return data || [];
}

// Classement des pilotes : 1res places, puis 2es, puis 3es. scope : "s1", "s2" ou "all" (maps de la communauté jamais comptées)
export async function podium(limit = 50, scope = "all") {
  const { data, error } = await supabase.rpc("racing_podium", { p_limit: limit, p_scope: scope });
  if (error) throw error;
  return data || [];
}
