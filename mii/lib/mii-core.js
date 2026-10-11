/* =========================================================
   MII CORE : modèle de données, valeurs par défaut, aléatoire,
   validation et code de partage. Aucune dépendance (pas de three),
   réutilisable tel quel dans les jeux du Casino.
   ========================================================= */

export const MII_VERSION = 1;

/* ---------- Palettes ---------- */
export const FAV_COLORS = ['#d21e14', '#ff6e19', '#ffd820', '#78d220', '#00782d', '#0a48b4',
    '#3caade', '#f55a7d', '#7328ad', '#483818', '#e0e0e0', '#181814'];
export const SKIN_COLORS = ['#ffe3cc', '#f9cfa8', '#eab48a', '#d79c6e', '#bb7c50', '#8f5636', '#673e25', '#4a2b19'];
export const HAIR_COLORS = ['#1e1a18', '#3d2618', '#5a2d18', '#a0442a', '#7a7a7a', '#7b5a32', '#d6a640', '#e8d29a',
    '#f2f2f2', '#c43a6e', '#3a6fd8', '#3fa65a'];
export const EYE_COLORS = ['#141414', '#6f6f6f', '#6b4426', '#6d6a26', '#3a6ccc', '#3c8c50', '#7c3fb0', '#b0302c'];
export const LIP_COLORS = ['#d8553e', '#e8383a', '#f08a8a', '#b8705c', '#8c3a52', '#3a3a3a'];
export const GLASSES_COLORS = ['#1a1a1a', '#6a4426', '#c0392b', '#2a5bd7', '#c9a227', '#8a8f98', '#f2f2f2', '#d64fa0'];
export const PANTS_COLORS = ['#40464f', '#1f2b4d', '#5b4632', '#2f2f2f', '#d9d4c7', '#4b6b3a'];
export const HAT_COLORS = ['#d21e14', '#1f2b4d', '#2f2f2f', '#f2f2f2', '#ffd820', '#3fa65a', '#7328ad', '#ff6e19'];

/* ---------- Nombre de variantes par catégorie ---------- */
export const COUNTS = {
    faceShape: 8,
    faceFeature: 12,
    hair: 24,
    brows: 14,
    eyes: 18,
    nose: 12,
    mouth: 14,
    mustache: 7,
    beard: 7,
    glasses: 10,
    hat: 9,
};

/* ---------- Curseurs : [min, max, défaut] ---------- */
export const RANGES = {
    'eyes.size': [0, 7, 4], 'eyes.rot': [0, 7, 3], 'eyes.spacing': [0, 12, 5], 'eyes.y': [0, 18, 9],
    'brows.size': [0, 8, 4], 'brows.rot': [0, 11, 6], 'brows.spacing': [0, 12, 5], 'brows.y': [0, 18, 9],
    'nose.size': [0, 8, 4], 'nose.y': [0, 18, 9],
    'mouth.size': [0, 8, 4], 'mouth.y': [0, 18, 9],
    'mustache.size': [0, 8, 4], 'mustache.y': [0, 16, 8],
    'glasses.size': [0, 7, 4], 'glasses.y': [0, 20, 10],
    'mole.size': [0, 8, 4], 'mole.x': [0, 16, 3], 'mole.y': [0, 30, 10],
    'body.height': [0, 127, 64], 'body.build': [0, 127, 64],
};

export function defaultMii(gender = 'm') {
    const f = gender === 'f';
    const now = Date.now();
    return {
        v: MII_VERSION,
        id: newId(),
        name: f ? 'Mii' : 'Mii',
        creator: '',
        gender,
        birthday: { d: 0, m: 0 },
        favColor: f ? 7 : 5,
        favorite: false,
        createdAt: now,
        updatedAt: now,
        body: { height: 64, build: 64, pants: 0 },
        face: { shape: 0, skin: SKIN_COLORS[1], feature: 0 },
        hair: { style: f ? 5 : 0, color: HAIR_COLORS[1], flip: false },
        brows: { type: f ? 1 : 0, color: HAIR_COLORS[1], size: 4, rot: 6, spacing: 5, y: 9 },
        eyes: { type: f ? 12 : 0, color: EYE_COLORS[0], size: 4, rot: 3, spacing: 5, y: 9 },
        nose: { type: 0, size: 4, y: 9 },
        mouth: { type: f ? 6 : 0, color: f ? LIP_COLORS[2] : LIP_COLORS[0], size: 4, y: 9 },
        mustache: { type: 0, size: 4, y: 8 },
        beard: { type: 0 },
        facialHairColor: HAIR_COLORS[1],
        glasses: { type: 0, color: GLASSES_COLORS[0], size: 4, y: 10, tint: false },
        mole: { on: false, size: 4, x: 3, y: 10 },
        hat: { type: 0, color: HAT_COLORS[0] },
    };
}

export function newId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return 'mii-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* Générateur pseudo-aléatoire reproductible (mulberry32) */
export function seededRandom(seed) {
    let a = 0;
    for (const c of String(seed)) a = (Math.imul(a ^ c.charCodeAt(0), 2654435761) + 0x9e3779b9) | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let R = Math.random;
const pick = (a) => a[Math.floor(R() * a.length)];
const rint = (n) => Math.floor(R() * n);
const around = (key, spread) => {
    const [lo, hi, def] = RANGES[key];
    return Math.max(lo, Math.min(hi, def + Math.round((R() * 2 - 1) * spread)));
};

const FEMALE_HAIR = [5, 6, 7, 8, 14, 16, 17, 18, 20, 22, 9, 13];
const MALE_HAIR = [0, 1, 2, 3, 4, 10, 11, 12, 13, 15, 19, 21, 23, 9];

export function randomMii(gender, rand = Math.random) {
    R = rand;
    try { return buildRandom(gender); } finally { R = Math.random; }
}

/* Mii stable pour un joueur sans Mii (bots, anciens clients) : même id → même tête partout */
export function miiForId(id, name = '') {
    const m = randomMii(null, seededRandom('mii:' + id));
    m.id = 'auto-' + String(id).slice(0, 40);
    if (name) m.name = String(name).slice(0, 10);
    return m;
}

function buildRandom(gender) {
    const g = gender || (R() < 0.5 ? 'm' : 'f');
    const m = defaultMii(g);
    const hairColor = R() < 0.85 ? pick(HAIR_COLORS.slice(0, 8)) : pick(HAIR_COLORS);
    m.favColor = rint(FAV_COLORS.length);
    m.face.shape = rint(COUNTS.faceShape);
    m.face.skin = pick(SKIN_COLORS);
    m.face.feature = R() < 0.5 ? 0 : rint(COUNTS.faceFeature);
    m.hair.style = pick(g === 'f' ? FEMALE_HAIR : MALE_HAIR);
    m.hair.color = hairColor;
    m.hair.flip = R() < 0.5;
    m.brows = { type: rint(COUNTS.brows), color: hairColor, size: around('brows.size', 2), rot: around('brows.rot', 2), spacing: around('brows.spacing', 2), y: around('brows.y', 2) };
    m.eyes = { type: rint(COUNTS.eyes), color: R() < 0.6 ? EYE_COLORS[0] : pick(EYE_COLORS.slice(0, 6)), size: around('eyes.size', 2), rot: around('eyes.rot', 1), spacing: around('eyes.spacing', 2), y: around('eyes.y', 2) };
    m.nose = { type: rint(COUNTS.nose), size: around('nose.size', 2), y: around('nose.y', 2) };
    m.mouth = { type: rint(COUNTS.mouth), color: g === 'f' ? pick(LIP_COLORS.slice(0, 4)) : LIP_COLORS[0], size: around('mouth.size', 2), y: around('mouth.y', 2) };
    m.facialHairColor = hairColor;
    if (g === 'm' && R() < 0.3) m.mustache = { type: 1 + rint(COUNTS.mustache - 1), size: around('mustache.size', 2), y: around('mustache.y', 1) };
    if (g === 'm' && R() < 0.25) m.beard = { type: 1 + rint(COUNTS.beard - 1) };
    if (R() < 0.25) m.glasses = { type: 1 + rint(COUNTS.glasses - 1), color: pick(GLASSES_COLORS), size: around('glasses.size', 1), y: around('glasses.y', 1), tint: R() < 0.2 };
    if (R() < 0.15) m.mole = { on: true, size: around('mole.size', 2), x: rint(17), y: rint(31) };
    m.body = { height: around('body.height', 40), build: around('body.build', 40), pants: rint(PANTS_COLORS.length) };
    return m;
}

/* ---------- Validation : tout ce qui vient du stockage ou d'un code passe par ici ---------- */
const HEX = /^#[0-9a-f]{6}$/i;
const clampInt = (v, lo, hi, def) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};
const color = (v, def) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : def);
const str = (v, max, def = '') => (typeof v === 'string' ? v.slice(0, max) : def);

export function sanitizeMii(raw) {
    const d = defaultMii(raw?.gender === 'f' ? 'f' : 'm');
    if (!raw || typeof raw !== 'object') return d;
    const r = (key, val) => { const [lo, hi, def] = RANGES[key]; return clampInt(val, lo, hi, def); };
    const o = {
        ...d,
        id: str(raw.id, 64) || d.id,
        name: str(raw.name, 10) || d.name,
        creator: str(raw.creator, 10),
        birthday: { d: clampInt(raw.birthday?.d, 0, 31, 0), m: clampInt(raw.birthday?.m, 0, 12, 0) },
        favColor: clampInt(raw.favColor, 0, FAV_COLORS.length - 1, d.favColor),
        favorite: !!raw.favorite,
        createdAt: clampInt(raw.createdAt, 0, 9e15, d.createdAt),
        updatedAt: clampInt(raw.updatedAt, 0, 9e15, d.updatedAt),
    };
    const b = raw.body || {}, f = raw.face || {}, h = raw.hair || {}, br = raw.brows || {}, e = raw.eyes || {},
        n = raw.nose || {}, mo = raw.mouth || {}, mu = raw.mustache || {}, g = raw.glasses || {}, ml = raw.mole || {}, ht = raw.hat || {};
    o.body = { height: r('body.height', b.height), build: r('body.build', b.build), pants: clampInt(b.pants, 0, PANTS_COLORS.length - 1, 0) };
    o.face = { shape: clampInt(f.shape, 0, COUNTS.faceShape - 1, 0), skin: color(f.skin, d.face.skin), feature: clampInt(f.feature, 0, COUNTS.faceFeature - 1, 0) };
    o.hair = { style: clampInt(h.style, 0, COUNTS.hair - 1, d.hair.style), color: color(h.color, d.hair.color), flip: !!h.flip };
    o.brows = { type: clampInt(br.type, 0, COUNTS.brows - 1, 0), color: color(br.color, d.brows.color), size: r('brows.size', br.size), rot: r('brows.rot', br.rot), spacing: r('brows.spacing', br.spacing), y: r('brows.y', br.y) };
    o.eyes = { type: clampInt(e.type, 0, COUNTS.eyes - 1, 0), color: color(e.color, d.eyes.color), size: r('eyes.size', e.size), rot: r('eyes.rot', e.rot), spacing: r('eyes.spacing', e.spacing), y: r('eyes.y', e.y) };
    o.nose = { type: clampInt(n.type, 0, COUNTS.nose - 1, 0), size: r('nose.size', n.size), y: r('nose.y', n.y) };
    o.mouth = { type: clampInt(mo.type, 0, COUNTS.mouth - 1, 0), color: color(mo.color, d.mouth.color), size: r('mouth.size', mo.size), y: r('mouth.y', mo.y) };
    o.mustache = { type: clampInt(mu.type, 0, COUNTS.mustache - 1, 0), size: r('mustache.size', mu.size), y: r('mustache.y', mu.y) };
    o.beard = { type: clampInt(raw.beard?.type, 0, COUNTS.beard - 1, 0) };
    o.facialHairColor = color(raw.facialHairColor, d.facialHairColor);
    o.glasses = { type: clampInt(g.type, 0, COUNTS.glasses - 1, 0), color: color(g.color, d.glasses.color), size: r('glasses.size', g.size), y: r('glasses.y', g.y), tint: !!g.tint };
    o.mole = { on: !!ml.on, size: r('mole.size', ml.size), x: r('mole.x', ml.x), y: r('mole.y', ml.y) };
    o.hat = { type: clampInt(ht.type, 0, COUNTS.hat - 1, 0), color: color(ht.color, d.hat.color) };
    return o;
}

/* ---------- Code de partage (texte copiable) ---------- */
const SHARE_PREFIX = 'MII1.';
export function encodeMii(mii) {
    const { id, createdAt, updatedAt, favorite, ...rest } = sanitizeMii(mii);
    const bytes = new TextEncoder().encode(JSON.stringify(rest));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return SHARE_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeMii(code) {
    const s = String(code || '').trim();
    if (!s.startsWith(SHARE_PREFIX)) throw new Error('bad-prefix');
    const b64 = s.slice(SHARE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const m = sanitizeMii(JSON.parse(json));
    m.id = newId();
    m.createdAt = m.updatedAt = Date.now();
    return m;
}

export const cloneMii = (m) => JSON.parse(JSON.stringify(m));

/* ---------- Mii invités : prêts à jouer, sans compte ni création ---------- */
function guest(n, name, gender, patch) {
    const m = defaultMii(gender);
    for (const [k, v] of Object.entries(patch)) m[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...m[k], ...v } : v;
    m.id = 'guest-' + n;
    m.name = name;
    m.creator = 'Invité';
    m.createdAt = m.updatedAt = 0;
    return m;
}
const H = HAIR_COLORS, S = SKIN_COLORS, E = EYE_COLORS, L = LIP_COLORS;
export const GUEST_MIIS = [
    guest(1, 'Alex', 'm', { favColor: 5, face: { shape: 0, skin: S[1] }, hair: { style: 0, color: H[1] }, brows: { type: 0, color: H[1] }, eyes: { type: 0 }, mouth: { type: 0 } }),
    guest(2, 'Léa', 'f', { favColor: 7, face: { shape: 1, skin: S[0], feature: 1 }, hair: { style: 5, color: H[6] }, brows: { type: 1, color: H[5] }, eyes: { type: 12, color: E[4] }, mouth: { type: 6, color: L[2] } }),
    guest(3, 'Hugo', 'm', { favColor: 3, face: { shape: 2, skin: S[2] }, hair: { style: 3, color: H[0] }, brows: { type: 2, color: H[0] }, eyes: { type: 11 }, mouth: { type: 1 } }),
    guest(4, 'Chloé', 'f', { favColor: 8, face: { shape: 4, skin: S[1], feature: 2 }, hair: { style: 14, color: H[3] }, brows: { type: 8, color: H[3] }, eyes: { type: 5, color: E[5] }, mouth: { type: 10, color: L[1] } }),
    guest(5, 'Nathan', 'm', { favColor: 0, face: { shape: 3, skin: S[4] }, hair: { style: 19, color: H[0] }, brows: { type: 3, color: H[0] }, eyes: { type: 2 }, mouth: { type: 4 }, beard: { type: 1 } }),
    guest(6, 'Inès', 'f', { favColor: 9, face: { shape: 0, skin: S[5], feature: 1 }, hair: { style: 9, color: H[0] }, brows: { type: 0, color: H[0] }, eyes: { type: 15, color: E[2] }, mouth: { type: 6, color: L[4] } }),
    guest(7, 'Karim', 'm', { favColor: 1, face: { shape: 5, skin: S[3] }, hair: { style: 1, color: H[0] }, brows: { type: 6, color: H[0] }, eyes: { type: 9, color: E[2] }, mouth: { type: 11 }, mustache: { type: 1 }, beard: { type: 4 }, facialHairColor: H[0] }),
    guest(8, 'Manon', 'f', { favColor: 2, face: { shape: 1, skin: S[0], feature: 10 }, hair: { style: 7, color: H[7] }, brows: { type: 1, color: H[6] }, eyes: { type: 1, color: E[4] }, mouth: { type: 7, color: L[2] } }),
    guest(9, 'Théo', 'm', { favColor: 6, face: { shape: 7, skin: S[1] }, hair: { style: 15, color: H[5] }, brows: { type: 9, color: H[5] }, eyes: { type: 4 }, mouth: { type: 9 }, glasses: { type: 1, color: GLASSES_COLORS[0] } }),
    guest(10, 'Jade', 'f', { favColor: 4, face: { shape: 4, skin: S[2] }, hair: { style: 8, color: H[1] }, brows: { type: 12, color: H[1] }, eyes: { type: 14, color: E[3] }, mouth: { type: 6, color: L[0] }, glasses: { type: 2, color: GLASSES_COLORS[4] } }),
    guest(11, 'Paul', 'm', { favColor: 10, face: { shape: 0, skin: S[1], feature: 11 }, hair: { style: 12, color: H[4] }, brows: { type: 10, color: H[4] }, eyes: { type: 6, color: E[1] }, mouth: { type: 3 }, mustache: { type: 4 }, facialHairColor: H[4], glasses: { type: 5, color: GLASSES_COLORS[5] } }),
    guest(12, 'Sofia', 'f', { favColor: 11, face: { shape: 6, skin: S[6], feature: 8 }, hair: { style: 22, color: H[0] }, brows: { type: 8, color: H[0] }, eyes: { type: 17, color: E[2] }, mouth: { type: 6, color: L[4] }, hat: { type: 5, color: HAT_COLORS[0] } }),
];
export const isGuestMii = (m) => typeof m?.id === 'string' && m.id.startsWith('guest-');
