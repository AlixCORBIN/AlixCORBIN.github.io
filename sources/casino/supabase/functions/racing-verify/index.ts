// TrackMerdia : validation serveur des temps.
// Le navigateur envoie ses entrées (touches / manette, quantifiées à chaque pas de 1/100 s) ;
// on rejoue la course avec la même physique et c'est CE temps-là, et ce fantôme-là, qui sont enregistrés.
// Code de jeu copié dans _lib par tools/sync-server.mjs (ne pas modifier _lib à la main).
// Saison 2 : les maps de campagne (racing_campaign) sont verrouillées tant que la saison n'est pas ouverte
// (season_live) ; avant le lancement, seuls les admins peuvent courir et leurs temps vont dans racing_records_test.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { initPhysics, WORLDS } from "./_lib/games/racing/physics.js";
import { FORMAT_VERSIONS, Track } from "./_lib/games/racing/track.js";
import { BLOCKS } from "./_lib/games/racing/blocks.js";
import { OFFICIAL } from "./_lib/games/racing/maps.js";
import { replay, validLog } from "./_lib/server/replay.js";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const MAX_STEPS = 15000; // 150 s : au-delà, la course n'est pas classée (limite de calcul)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const physics = initPhysics();

// RPC booléenne : false en cas d'erreur (on refuse plutôt que d'ouvrir par erreur)
async function rpcTrue(fn: string, args: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await db.rpc(fn, args);
  if (error) console.warn(fn, error.message);
  return !error && data === true;
}
// La map utilise-t-elle un bloc de la saison 2 ?
const usesSeason2 = (data: any) =>
  Array.isArray(data?.tiles) && data.tiles.some((t: any) => Array.isArray(t) && (BLOCKS as any)[t[2]]?.season === 2);

// Temps admin avant lancement : meilleur temps conservé par (map, pseudo), comme racing_records
async function submitTest(mapId: string, pseudo: string, ms: number, ghost: unknown) {
  const { data: prev, error } = await db.from("racing_records_test").select("time_ms, attempts")
    .eq("map_id", mapId).eq("pseudo", pseudo).maybeSingle();
  if (error) throw error;
  if (!prev) {
    const { error: e } = await db.from("racing_records_test").insert({ map_id: mapId, pseudo, time_ms: ms, ghost });
    if (e) throw e;
    return ms;
  }
  const better = ms < prev.time_ms;
  const { error: e } = await db.from("racing_records_test").update({
    attempts: (prev.attempts ?? 1) + 1,
    ...(better ? { time_ms: ms, ghost, updated_at: new Date().toISOString() } : {}),
  }).eq("map_id", mapId).eq("pseudo", pseudo);
  if (e) throw e;
  return better ? ms : prev.time_ms;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await db.auth.getUser(jwt);
    const uid = auth?.user?.id;
    if (!uid) return reply({ error: "Connexion requise" }, 401);
    const { data: wallet } = await db.from("wallets").select("pseudo, banned").eq("user_id", uid).maybeSingle();
    const pseudo = wallet?.pseudo;
    if (!pseudo) return reply({ error: "Choisis un pseudo dans le hall pour etre classe" }, 400);
    const { data: banned } = await db.rpc("player_banned", { p: pseudo });
    if (wallet.banned || banned) return reply({ error: "Compte banni pour triche" }, 403);

    const body = await req.json().catch(() => ({}));
    const mapId = String(body.map || "");
    if (!mapId || mapId.length > 40) return reply({ error: "Map invalide" }, 400);
    if (!validLog(body.log, MAX_STEPS)) return reply({ error: "Journal de course invalide" }, 400);

    // Map : officielle, puis campagne de saison, puis communautaire
    const official = OFFICIAL.find((m: any) => m.id === mapId);
    let data: any = official?.data;
    let campaign: { season_id: string; starts_at: string | null } | null = null;
    if (!data) {
      const { data: row, error } = await db.from("racing_campaign").select("data, season_id, starts_at").eq("map_id", mapId).maybeSingle();
      if (error) console.warn("racing_campaign", error.message); // table absente tant que la migration n'est pas appliquée
      if (row?.data) { data = row.data; campaign = { season_id: row.season_id, starts_at: row.starts_at }; }
    }
    if (!data && /^[0-9a-f-]{36}$/.test(mapId)) {
      const { data: row } = await db.from("racing_maps").select("data").eq("map_id", mapId).maybeSingle();
      data = row?.data;
    }
    if (!data) return reply({ error: "Map inconnue" }, 404);
    if (!FORMAT_VERSIONS.includes(data.v ?? 1)) return reply({ error: "Version de map inconnue" }, 400);

    // Verrou de saison. is_admin reçoit l'uid explicite : avec la clé service, auth.uid() est nul.
    let admin: boolean | null = null;
    const isAdmin = async () => (admin ??= await rpcTrue("is_admin", { uid }));
    let testOnly = false;
    if (campaign) {
      // map fermée : saison pas ouverte, ou déblocage quotidien (starts_at) pas encore atteint
      const notYet = campaign.starts_at !== null && Date.parse(campaign.starts_at) > Date.now();
      if (notYet || !(await rpcTrue("season_live", { p_id: campaign.season_id }))) {
        if (!(await isAdmin())) return reply({ error: "Saison pas encore ouverte" }, 403);
        testOnly = true;
      }
    } else if (!official && usesSeason2(data) && !(await rpcTrue("season_live", { p_id: "s2" })) && !(await isAdmin())) {
      return reply({ error: "Saison pas encore ouverte" }, 403);
    }

    await physics;
    const track = new Track(data);
    const world = WORLDS[data.world ?? 0] || WORLDS[0];
    const r = replay(track, world, body.log, MAX_STEPS);
    if (!r.finished) {
      await db.from("racing_rejected").insert({ map_id: mapId, pseudo, time_ms: Number(body.ms) || null, reason: "rejeu : arrivee non atteinte" });
      return reply({ error: "Course non validee par le serveur" }, 422);
    }
    if (testOnly) {
      // admin avant lancement : mêmes contrôles de fantôme, mais jamais dans racing_records
      const { data: why, error: ge } = await db.rpc("racing_ghost_problem", { p_map: mapId, p_time: r.ms, g: r.ghost });
      if (ge) return reply({ error: ge.message }, 500);
      if (why) return reply({ error: `Fantôme refusé (test) : ${why}`, test: true }, 422);
      const best = await submitTest(mapId, pseudo, Number(r.ms), r.ghost);
      return reply({ rank: null, ms: r.ms, claimed: Number(body.ms) || null, test: true, best });
    }
    const { data: rank, error } = await db.rpc("racing_submit", { p_map: mapId, p_pseudo: pseudo, p_time: r.ms, p_ghost: r.ghost });
    if (error) return reply({ error: error.message }, 500);
    return reply({ rank: rank ?? null, ms: r.ms, claimed: Number(body.ms) || null });
  } catch (e) {
    return reply({ error: String((e as Error).message || e) }, 500);
  }
});
