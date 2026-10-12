// Tables d'argent du Casino (blackjack, roulette) : le serveur distribue, tire, paie et tient les soldes.
// Le navigateur envoie seulement des intentions ; la vue publique est diffusée via casino_room_views (Realtime).
// Les moteurs de jeu sont copiés dans _lib par tools/sync-server.mjs (ne pas modifier _lib à la main).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import * as T from "./_lib/server/tables.js";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHA[b % ALPHA.length]).join("");

async function fetchRandom(kind: string, n: number) {
  const [min, max] = kind === "keys" ? [0, 999999999] : [0, 36];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${URL}/functions/v1/random-shoe?n=${n}&min=${min}&max=${max}`, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
    });
    const body = await res.json();
    const values = body?.random?.data;
    if (!Array.isArray(values) || values.length !== n) return null;
    return { values, meta: { source: "random.org", at: Date.now(), proof: { random: body.random, signature: body.signature } } };
  } catch {
    return null; // les moteurs retombent sur le CSPRNG
  } finally {
    clearTimeout(timer);
  }
}

async function topUpRandom(room: any) {
  const need = T.needsRandom(room);
  if (!need) return;
  const r = await fetchRandom(need.kind, need.n);
  if (r) T.feedRandom(room, r.values, r.meta);
  else if (room.game === "blackjack") room.g.rng.error = "random.org injoignable : CSPRNG serveur utilise";
}

function sanitizeMii(m: unknown) {
  if (!m || typeof m !== "object") return null;
  const s = JSON.stringify(m);
  return s.length < 4000 ? JSON.parse(s) : null;
}

async function commit(room: any, version: number, before: Set<string>) {
  const now = Date.now();
  const seated = Object.entries(room.members).filter(([, m]: any) => !m.kicked).map(([u]) => u);
  const left = [...before].filter((u) => !seated.includes(u));
  let sessions: unknown[] = [];
  if (room.g.phase === "settle" && room.sessionRound !== room.g.round) {
    room.sessionRound = room.g.round;
    sessions = T.sessionRows(room);
  }
  const spins = room.spins.splice(0);
  const wallets = [...(room.pending || []), ...T.walletUpdates(room)];
  delete room.pending;
  const miis: Record<string, unknown> = {};
  for (const [u, m] of Object.entries(room.members) as any) if (m.mii) miis[u] = m.mii;
  const { data, error } = await db.rpc("casino_commit", {
    p_code: room.code, p_version: version, p_game: room.game, p_room: room, p_view: T.view(room, now), p_miis: miis,
    p_public: room.isPublic, p_wallets: wallets, p_sessions: sessions, p_spins: spins.length ? spins : null,
    p_seated: seated, p_left: left,
  });
  if (error) throw new Error(error.message);
  if (!seated.length) await db.from("casino_rooms").delete().eq("code", room.code);
  return data as number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await db.auth.getUser(jwt);
    const uid = auth?.user?.id;
    if (!uid) return reply({ error: "Connexion requise" }, 401);
    const body = await req.json().catch(() => ({}));
    const op = String(body.op || "");

    await db.from("wallets").upsert({ user_id: uid }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: wallet } = await db.from("wallets").select("*").eq("user_id", uid).maybeSingle();
    if (!wallet) return reply({ error: "Portefeuille introuvable" }, 400);
    const { data: banned } = await db.rpc("player_banned", { p: wallet.pseudo || "" });
    if (wallet.banned || banned) return reply({ error: "Compte banni pour triche" }, 403);
    const name = wallet.pseudo || "Joueur";

    if (op === "create") {
      if (!T.GAMES.includes(body.game)) return reply({ error: "Jeu inconnu" }, 400);
      if (wallet.seat && wallet.seat_at && Date.now() - Date.parse(wallet.seat_at) < 30000)
        return reply({ error: "Tu es deja assis a une autre table" }, 409);
      for (let i = 0; i < 6; i++) {
        const room = T.createRoom(body.game, makeCode(), !!body.isPublic);
        const now = Date.now();
        T.join(room, uid, name, Number(wallet.bankroll), sanitizeMii(body.mii), now, crypto.randomUUID());
        await topUpRandom(room);
        try {
          const version = await commit(room, 0, new Set());
          return reply({ code: room.code, me: uid, version, view: T.view(room, Date.now()) });
        } catch (e) {
          if (!String(e).includes("duplicate")) throw e;
        }
      }
      return reply({ error: "Impossible de creer la salle" }, 500);
    }

    const code = String(body.code || "").toUpperCase().trim();
    if (!/^[A-Z0-9]{5}$/.test(code)) return reply({ error: "Code invalide" }, 400);
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: row } = await db.from("casino_rooms").select("room, version").eq("code", code).maybeSingle();
      if (!row) return reply({ error: "Salle introuvable" }, 404);
      const room = row.room;
      const before = new Set(Object.entries(room.members).filter(([, m]: any) => !m.kicked).map(([u]) => u));
      const now = Date.now();
      T.dropStale(room, now);
      T.tick(room, now);
      await topUpRandom(room);
      let res: any = { ok: true };
      const m = room.members[uid];
      if (op === "join") {
        if (!m && wallet.seat && wallet.seat !== code && wallet.seat_at && now - Date.parse(wallet.seat_at) < 30000)
          return reply({ error: "Tu es deja assis a une autre table" }, 409);
        res = T.join(room, uid, name, Number(wallet.bankroll), sanitizeMii(body.mii), now, crypto.randomUUID());
      } else if (op === "act") {
        res = T.act(room, uid, body.action, now);
      } else if (op === "ping") {
        if (m && !m.kicked) m.seen = now;
      } else if (op === "public") {
        if (m && !m.kicked) room.isPublic = !!body.isPublic;
      } else if (op === "leave") {
        if (m && !m.kicked) {
          // solde réglé au moment du départ (les mises déjà engagées dans la manche sont perdues)
          room.pending = T.walletUpdates(room).filter((x: any) => x.uid === uid);
          T.leave(room, uid, now);
        }
      } else return reply({ error: "Operation inconnue" }, 400);
      T.tick(room, Date.now());
      await topUpRandom(room);
      try {
        const version = await commit(room, row.version, before);
        const kicked = room.members[uid]?.kicked;
        return reply({ ok: !!res.ok, error: res.ok ? undefined : res.error, code, me: uid, version, kicked, view: T.view(room, Date.now()) });
      } catch (e) {
        if (!String(e).includes("conflict")) throw e;
        await new Promise((r) => setTimeout(r, 30 + Math.random() * 80));
      }
    }
    return reply({ error: "Table occupee, reessaie" }, 503);
  } catch (e) {
    return reply({ error: String((e as Error).message || e) }, 500);
  }
});
