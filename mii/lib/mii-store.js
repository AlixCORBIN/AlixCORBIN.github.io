/* =========================================================
   MII STORE : stockage des Mii.
   - Toujours une copie dans le localStorage (marche hors ligne, sans compte).
   - Si un compte est connecté (attachAccount), chaque modification part aussi
     dans Supabase et une synchronisation fusionne les deux au login.
   ========================================================= */
import { sanitizeMii, MII_VERSION } from './mii-core.js';

const KEY = 'portfolio.miis.v1';
const SYNCED_KEY = 'portfolio.miis.synced.';
export const MAX_MIIS = 100;

function readRaw() {
    try {
        const o = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (o && Array.isArray(o.miis)) return o;
    } catch { /* stockage indisponible ou corrompu */ }
    return { v: MII_VERSION, mainId: null, miis: [] };
}
function writeRaw(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; }
    catch { return false; }
}

const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });

/* ---------------- Nuage (compte connecté) ---------------- */
let cloud = null;          // { sb, uid }
let syncState = 'local';   // 'local' | 'syncing' | 'synced' | 'error'
const setSync = (s) => { syncState = s; emit(); };

const readSynced = (uid) => { try { return new Set(JSON.parse(localStorage.getItem(SYNCED_KEY + uid) || '[]')); } catch { return new Set(); } };
const writeSynced = (uid, set) => { try { localStorage.setItem(SYNCED_KEY + uid, JSON.stringify([...set])); } catch { /* ignore */ } };
const row = (m, uid) => ({ user_id: uid, id: m.id, data: m, updated_at: new Date(m.updatedAt || Date.now()).toISOString() });

async function cloudCall(fn) {
    if (!cloud) return;
    const c = cloud;
    try {
        const { error } = await fn(c.sb);
        if (error) throw error;
        if (syncState === 'error') setSync('synced');
    } catch (e) {
        console.warn('[mii] synchro:', e?.message || e);
        setSync('error');
    }
}

async function syncNow() {
    if (!cloud) return;
    const { sb, uid } = cloud;
    setSync('syncing');
    try {
        const [{ data: rows, error: e1 }, { data: setting, error: e2 }] = await Promise.all([
            sb.from('user_miis').select('id,data,updated_at'),
            sb.from('user_mii_settings').select('main_id').maybeSingle(),
        ]);
        if (e1 || e2) throw e1 || e2;
        if (!cloud || cloud.uid !== uid) return;
        const o = readRaw();
        const synced = readSynced(uid);
        const remote = new Map(rows.map((r) => [r.id, sanitizeMii({ ...r.data, id: r.id })]));
        const local = new Map(o.miis.map((m) => [m.id, sanitizeMii(m)]));
        const upload = [];

        for (const [id, rm] of remote) {
            const lm = local.get(id);
            if (!lm || rm.updatedAt > lm.updatedAt) local.set(id, rm);
            else if (lm.updatedAt > rm.updatedAt) upload.push(lm);
        }
        for (const [id, lm] of local) {
            if (remote.has(id)) continue;
            if (synced.has(id)) local.delete(id);          // effacé depuis un autre appareil
            else upload.push(lm);
        }
        const list = [...local.values()].sort((a, b) => a.createdAt - b.createdAt).slice(0, MAX_MIIS);
        let mainId = setting?.main_id && local.has(setting.main_id) ? setting.main_id : o.mainId;
        if (!list.some((m) => m.id === mainId)) mainId = list[0]?.id || null;
        writeRaw({ ...o, miis: list, mainId });

        const keep = new Set(list.map((m) => m.id));
        const toSend = upload.filter((m) => keep.has(m.id));
        if (toSend.length) {
            const { error } = await sb.from('user_miis').upsert(toSend.map((m) => row(m, uid)));
            if (error) throw error;
        }
        if (mainId !== (setting?.main_id || null)) {
            const { error } = await sb.from('user_mii_settings').upsert({ user_id: uid, main_id: mainId, updated_at: new Date().toISOString() });
            if (error) throw error;
        }
        writeSynced(uid, keep);
        setSync('synced');
    } catch (e) {
        console.warn('[mii] synchro:', e?.message || e);
        setSync('error');
    }
}

/* Branche un compte (voir account.js). Renvoie une fonction de débranchement. */
export function attachAccount(account) {
    const apply = (user) => {
        const uid = user?.id || null;
        if (uid === (cloud?.uid || null)) return;
        cloud = uid ? { sb: account.sb, uid } : null;
        if (cloud) syncNow(); else setSync('local');
    };
    account.ready.then(() => apply(account.user));
    return account.onChange((u) => apply(u));
}

/* ---------------- API ---------------- */
export const miiStore = {
    get syncState() { return syncState; },
    get cloudUser() { return cloud?.uid || null; },
    sync: syncNow,

    async list() { return readRaw().miis.map(sanitizeMii); },
    async get(id) { const m = readRaw().miis.find((x) => x.id === id); return m ? sanitizeMii(m) : null; },
    async save(mii) {
        const o = readRaw();
        const m = sanitizeMii({ ...mii, updatedAt: Date.now() });
        const i = o.miis.findIndex((x) => x.id === m.id);
        if (i >= 0) o.miis[i] = m;
        else {
            if (o.miis.length >= MAX_MIIS) throw new Error('full');
            o.miis.push(m);
        }
        if (!o.mainId) o.mainId = m.id;
        if (!writeRaw(o)) throw new Error('storage');
        emit();
        if (cloud) {
            const uid = cloud.uid;
            cloudCall((sb) => sb.from('user_miis').upsert(row(m, uid))).then(() => {
                if (cloud?.uid === uid) { const s = readSynced(uid); s.add(m.id); writeSynced(uid, s); }
            });
            if (o.mainId === m.id) cloudCall((sb) => sb.from('user_mii_settings').upsert({ user_id: uid, main_id: m.id, updated_at: new Date().toISOString() }));
        }
        return m;
    },
    async remove(id) {
        const o = readRaw();
        o.miis = o.miis.filter((x) => x.id !== id);
        if (o.mainId === id) o.mainId = o.miis[0]?.id || null;
        writeRaw(o); emit();
        if (cloud) {
            const uid = cloud.uid;
            cloudCall((sb) => sb.from('user_miis').delete().eq('id', id)).then(() => {
                if (cloud?.uid === uid) { const s = readSynced(uid); s.delete(id); writeSynced(uid, s); }
            });
            cloudCall((sb) => sb.from('user_mii_settings').upsert({ user_id: uid, main_id: o.mainId, updated_at: new Date().toISOString() }));
        }
    },
    async getMainId() { return readRaw().mainId; },
    async getMain() { return getMainSync(); },
    async setMain(id) {
        const o = readRaw(); o.mainId = id; writeRaw(o); emit();
        if (cloud) { const uid = cloud.uid; cloudCall((sb) => sb.from('user_mii_settings').upsert({ user_id: uid, main_id: id, updated_at: new Date().toISOString() })); }
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

/* Lecture synchrone du Mii principal (utile au démarrage d'un jeu) */
export function getMainSync() {
    const o = readRaw();
    const m = o.miis.find((x) => x.id === o.mainId) || o.miis[0];
    return m ? sanitizeMii(m) : null;
}
export function listSync() { return readRaw().miis.map(sanitizeMii); }

// Synchronisation entre onglets (le Casino ouvert à côté voit le changement)
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => { if (e.key === KEY) emit(); });
}
