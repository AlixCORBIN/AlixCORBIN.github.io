// TrackMerdia : validation serveur des temps.
// Le navigateur envoie ses entrées (touches / manette, quantifiées à chaque pas de 1/100 s) ;
// on rejoue la course avec la même physique et c'est CE temps-là, et ce fantôme-là, qui sont enregistrés.
// Code de jeu copié dans _lib par tools/sync-server.mjs (ne pas modifier _lib à la main).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { initPhysics, WORLDS } from "./_lib/games/racing/physics.js";
import { Track } from "./_lib/games/racing/track.js";
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

    let data: any = OFFICIAL.find((m: any) => m.id === mapId)?.data;
    if (!data && /^[0-9a-f-]{36}$/.test(mapId)) {
      const { data: row } = await db.from("racing_maps").select("data").eq("map_id", mapId).maybeSingle();
      data = row?.data;
    }
    if (!data) return reply({ error: "Map inconnue" }, 404);

    await physics;
    const track = new Track(data);
    const world = WORLDS[data.world ?? 0] || WORLDS[0];
    const r = replay(track, world, body.log, MAX_STEPS);
    if (!r.finished) {
      await db.from("racing_rejected").insert({ map_id: mapId, pseudo, time_ms: Number(body.ms) || null, reason: "rejeu : arrivee non atteinte" });
      return reply({ error: "Course non validee par le serveur" }, 422);
    }
    const { data: rank, error } = await db.rpc("racing_submit", { p_map: mapId, p_pseudo: pseudo, p_time: r.ms, p_ghost: r.ghost });
    if (error) return reply({ error: error.message }, 500);
    return reply({ rank: rank ?? null, ms: r.ms, claimed: Number(body.ms) || null });
  } catch (e) {
    return reply({ error: String((e as Error).message || e) }, 500);
  }
});
