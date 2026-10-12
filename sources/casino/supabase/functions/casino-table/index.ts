// Tables d'argent du Casino (blackjack, roulette) : le serveur distribue, tire, paie et tient les soldes.
// Le navigateur envoie seulement des intentions ; la vue publique est diffusée via casino_room_views (Realtime).
// Les moteurs de jeu sont copiés dans _lib par tools/sync-server.mjs (ne pas modifier _lib à la main).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import * as T from "./_lib/server/tables.js";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

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

// Tirages random.org signés, demandés directement par la fonction (clé RANDOM_ORG_KEY, secret du projet).
// Passer par random-shoe ne marchait pas : elle limite à 1 appel / 3 s par IP, et tous les appels
// de casino-table partent des mêmes serveurs.
async function fetchRandom(kind: string, n: number) {
  const key = Deno.env.get("RANDOM_ORG_KEY");
  if (!key) return null; // les moteurs retombent sur le CSPRNG du serveur
  const [min, max] = kind === "keys" ? [0, 999999999] : [0, 36];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch("https://api.random.org/json-rpc/4/invoke", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "generateSignedIntegers", params: { apiKey: key, n, min, max, replacement: true } }),
    });
    const body = await res.json();
    const values = body?.result?.random?.data;
    if (!Array.isArray(values) || values.length !== n) return null;
    return { values, meta: { source: "random.org", at: Date.now(), proof: { random: body.result.random, signature: body.result.signature } } };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// random.org en arrière-plan, après la réponse au joueur : la réserve est rechargée avant d'être vide,
// le joueur n'attend jamais l'appel externe (si elle était vide, les moteurs utilisent le CSPRNG serveur).
function refillLater(code: string, need: { kind: string; n: number } | null) {
  if (!need) return;
  const task = (async () => {
    const r = await fetchRandom(need.kind, need.n);
    if (!r) return;
    for (let i = 0; i < 4; i++) {
      const { data: row } = await db.from("casino_rooms").select("room, version").eq("code", code).maybeSingle();
      if (!row || !T.needsRandom(row.room)) return;
      T.feedRandom(row.room, r.values, r.meta);
      try {
        await commit(row.room, row.version, new Set(seatedOf(row.room)));
        return;
      } catch (e) {
        if (!String(e).includes("conflict")) return;
      }
    }
  })().catch(() => {});
  // @ts-ignore EdgeRuntime existe dans le runtime Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
}

const seatedOf = (room: any) => Object.entries(room.members).filter(([, m]: any) => !m.kicked).map(([u]) => u);

// Vérification complète du jeton en local (signature ES256 avec les clés publiques du projet, mises en cache,
// émetteur, expiration) : plus d'aller-retour vers le service d'authentification à chaque action.
// Si la clé n'est pas reconnue (ancien jeton), on retombe sur la vérification par le service d'authentification.
const JWKS = createRemoteJWKSet(new globalThis.URL(`${URL}/auth/v1/.well-known/jwks.json`));
async function verifiedUid(jwt: string): Promise<string | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, JWKS, { issuer: `${URL}/auth/v1`, audience: "authenticated" });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    const { data } = await db.auth.getUser(jwt);
    return data?.user?.id ?? null;
  }
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
    const uid = await verifiedUid((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
    if (!uid) return reply({ error: "Connexion requise" }, 401);
    const body = await req.json().catch(() => ({}));
    const op = String(body.op || "");
    const code = op === "create" ? null : String(body.code || "").toUpperCase().trim();
    if (code !== null && !/^[A-Z0-9]{5}$/.test(code)) return reply({ error: "Code invalide" }, 400);

    // une seule lecture : portefeuille (créé au besoin), bannissement et salle
    let { data: load, error: loadErr } = await db.rpc("casino_load", { p_uid: uid, p_code: code });
    if (loadErr || !load) return reply({ error: loadErr?.message || "Portefeuille introuvable" }, 400);
    const wallet = load.wallet;
    if (load.banned) return reply({ error: "Compte banni pour triche" }, 403);
    const name = wallet.pseudo || "Joueur";
    const seatBusy = (other: string | null) =>
      wallet.seat && wallet.seat !== other && wallet.seat_at && Date.now() - Date.parse(wallet.seat_at) < 30000;

    if (op === "create") {
      if (!T.GAMES.includes(body.game)) return reply({ error: "Jeu inconnu" }, 400);
      if (seatBusy(null)) return reply({ error: "Tu es deja assis a une autre table" }, 409);
      for (let i = 0; i < 6; i++) {
        const room = T.createRoom(body.game, makeCode(), !!body.isPublic);
        T.join(room, uid, name, Number(wallet.bankroll), sanitizeMii(body.mii), Date.now(), crypto.randomUUID());
        try {
          const version = await commit(room, 0, new Set());
          refillLater(room.code, T.needsRandom(room));
          return reply({ code: room.code, me: uid, version, view: T.view(room, Date.now()) });
        } catch (e) {
          if (!String(e).includes("duplicate")) throw e;
        }
      }
      return reply({ error: "Impossible de creer la salle" }, 500);
    }

    // plusieurs actions peuvent arriver d'un coup (mises posées en local puis envoyées ensemble)
    const actions = op === "act" ? (Array.isArray(body.actions) ? body.actions.slice(0, 60) : [body.action]) : [];
    for (let attempt = 0; attempt < 8; attempt++) {
      if (attempt > 0) load = (await db.rpc("casino_load", { p_uid: uid, p_code: code })).data;
      const row = load?.room;
      if (!row) return reply({ error: "Salle introuvable" }, 404);
      const room = row.room;
      const before = new Set(seatedOf(room));
      const now = Date.now();
      T.dropStale(room, now);
      T.tick(room, now);
      let res: any = { ok: true };
      const m = room.members[uid];
      if (op === "join") {
        if (!m && seatBusy(code)) return reply({ error: "Tu es deja assis a une autre table" }, 409);
        res = T.join(room, uid, name, Number(wallet.bankroll), sanitizeMii(body.mii), now, crypto.randomUUID());
      } else if (op === "act") {
        for (const a of actions) {
          res = T.act(room, uid, a, now);
          if (!res.ok) break;
        }
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
      try {
        const version = await commit(room, row.version, before);
        refillLater(code!, T.needsRandom(room));
        const kicked = room.members[uid]?.kicked;
        return reply({ ok: !!res.ok, error: res.ok ? undefined : res.error, code, me: uid, version, kicked, view: T.view(room, Date.now()) });
      } catch (e) {
        if (!String(e).includes("conflict")) throw e;
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 60));
      }
    }
    return reply({ error: "Table occupee, reessaie" }, 503);
  } catch (e) {
    return reply({ error: String((e as Error).message || e) }, 500);
  }
});
