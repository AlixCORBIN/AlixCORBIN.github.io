/* =========================================================
   CACHE DES VIGNETTES : les portraits 3D des Mii sont rendus une
   seule fois puis gardés dans IndexedDB (partagé par la chaîne Mii
   et le Casino). Clé = apparence du Mii, donc un Mii modifié
   obtient automatiquement une nouvelle vignette.
   ========================================================= */
const DB = 'portfolio-mii-thumbs';
const STORE = 't';
const VERSION = 'v1';      // à incrémenter si le rendu des Mii change
const MAX = 400;

const mem = new Map();
let dbp = null;
let puts = 0;

function db() {
    if (!dbp) {
        dbp = new Promise((resolve) => {
            try {
                const r = indexedDB.open(DB, 1);
                r.onupgradeneeded = () => r.result.createObjectStore(STORE);
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => resolve(null);
            } catch { resolve(null); }
        });
    }
    return dbp;
}

// Hash court (FNV-1a) de l'apparence : nom, dates et favori n'influencent pas le rendu
export function thumbKey(m, mode = 'head', size = 0) {
    const { id, name, creator, createdAt, updatedAt, favorite, birthday, ...look } = m;
    const s = JSON.stringify(look);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return `${VERSION}:${mode}:${size}:${(h >>> 0).toString(36)}:${s.length}`;
}

export async function getThumb(key) {
    if (mem.has(key)) return mem.get(key);
    const d = await db();
    if (!d) return null;
    return new Promise((resolve) => {
        try {
            const q = d.transaction(STORE).objectStore(STORE).get(key);
            q.onsuccess = () => { const url = q.result?.url || null; if (url) mem.set(key, url); resolve(url); };
            q.onerror = () => resolve(null);
        } catch { resolve(null); }
    });
}
export const peekThumb = (key) => mem.get(key) || null;

export async function putThumb(key, url) {
    mem.set(key, url);
    const d = await db();
    if (!d) return;
    try { d.transaction(STORE, 'readwrite').objectStore(STORE).put({ url, at: Date.now() }, key); } catch { return; }
    if (++puts % 40 === 0) prune(d);
}

// Garde les MAX vignettes les plus récentes
function prune(d) {
    try {
        const items = [];
        const req = d.transaction(STORE).objectStore(STORE).openCursor();
        req.onsuccess = () => {
            const c = req.result;
            if (c) { items.push([c.key, c.value.at || 0]); c.continue(); return; }
            if (items.length <= MAX) return;
            items.sort((a, b) => a[1] - b[1]);
            const st = d.transaction(STORE, 'readwrite').objectStore(STORE);
            items.slice(0, items.length - MAX).forEach(([k]) => { st.delete(k); mem.delete(k); });
        };
    } catch { /* ignore */ }
}
