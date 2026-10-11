// Records et maps de la communauté (RPC Supabase, voir supabase/racing.sql)
import { supabase } from "../../lib/supabase.js";

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

// Enregistre automatiquement chaque arrivée. Retourne { pb, rank }.
export async function submitTime(mapId, pseudo, ms, ghost, splits) {
  const prev = localPB(mapId);
  const pb = !prev || ms < prev.ms;
  if (pb) savePB(mapId, ms, ghost, splits);
  if (!pseudo || pseudo === "Joueur") return { pb, rank: null };
  const { data, error } = await supabase.rpc("racing_submit", { p_map: mapId, p_pseudo: pseudo, p_time: ms, p_ghost: ghost });
  if (error) console.warn("racing_submit", error.message);
  return { pb, rank: data ?? null };
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
