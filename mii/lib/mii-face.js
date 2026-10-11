/* =========================================================
   MII FACE : dessin 2D des traits (yeux, sourcils, bouche,
   moustache, barbe, maquillage, grain de beauté) sur un canvas
   512x512 qui est ensuite plaqué sur l'avant de la tête 3D.
   Repère : x=256 milieu du visage, y=205 niveau des yeux par défaut.
   ========================================================= */

export const FACE_TEX = 512;

export function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* Pseudo-aléatoire stable (pour taches de rousseur, barbe de 3 jours) */
function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* ---------------- YEUX ---------------- */
const EYES = [
    { t: .62, b: .5 },
    { t: .85, b: .8, iris: .62 },
    { t: .42, b: .32 },
    { t: .6, b: .45, tilt: .25 },
    { t: .6, b: .4, tilt: -.3, lash: 3 },
    { t: .9, b: .85, iris: .7, lash: 3 },
    { t: .38, b: .55, lid: true },
    { special: 'dot' },
    { special: 'happy' },
    { t: .55, b: .45, bags: true },
    { t: .45, b: .5, tilt: -.15, angry: true },
    { t: .7, b: .6, iris: .36 },
    { t: .65, b: .5, lash: 2 },
    { t: .52, b: .52, w: 1.22 },
    { t: .6, b: .45, lash: 2, low: true },
    { t: .95, b: .9, iris: .8, anime: true },
    { special: 'line' },
    { t: .75, b: .65, iris: .6, sparkle: true },
];

function eyePath(ctx, e) {
    const w = e.w || 1, tilt = e.tilt || 0;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(0, -2 * e.t, w, tilt);
    ctx.quadraticCurveTo(0, 2 * e.b, -w, 0);
    ctx.closePath();
}

function drawEyeUnit(ctx, type, color, blink) {
    const e = EYES[type] || EYES[0];
    const ink = '#22170f';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (e.special === 'dot') {
        if (blink) { ctx.strokeStyle = ink; ctx.lineWidth = .22; ctx.beginPath(); ctx.moveTo(-.35, 0); ctx.lineTo(.35, 0); ctx.stroke(); return; }
        ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(0, 0, .36, .48, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-.1, -.16, .11, 0, Math.PI * 2); ctx.fill();
        return;
    }
    if (e.special === 'happy') {
        ctx.strokeStyle = ink; ctx.lineWidth = .24;
        ctx.beginPath(); ctx.moveTo(-.85, .2); ctx.quadraticCurveTo(0, -.75, .85, .2); ctx.stroke();
        return;
    }
    if (e.special === 'line' || blink) {
        const tilt = e.tilt || 0;
        ctx.strokeStyle = ink; ctx.lineWidth = .22;
        ctx.beginPath(); ctx.moveTo(-(e.w || 1) * .9, 0); ctx.quadraticCurveTo(0, .35, (e.w || 1) * .9, tilt); ctx.stroke();
        if (e.lash) { ctx.lineWidth = .14; ctx.beginPath(); ctx.moveTo(.8, tilt * .9); ctx.lineTo(1.1, tilt + .2); ctx.stroke(); }
        return;
    }
    // Blanc de l'oeil
    eyePath(ctx, e);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.save(); eyePath(ctx, e); ctx.clip();
    const ir = (e.iris || .52);
    const iy = (e.b - e.t) * .15;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, iy, ir, 0, Math.PI * 2); ctx.fill();
    if (e.anime) {
        const g = ctx.createLinearGradient(0, iy - ir, 0, iy + ir);
        g.addColorStop(0, rgba('#000000', .45)); g.addColorStop(1, rgba('#ffffff', .15));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, iy, ir, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#0b0b0b'; ctx.beginPath(); ctx.arc(0, iy, ir * .5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-ir * .38, iy - ir * .38, ir * (e.anime ? .36 : .26), 0, Math.PI * 2); ctx.fill();
    if (e.anime || e.sparkle) { ctx.beginPath(); ctx.arc(ir * .35, iy + ir * .35, ir * .13, 0, Math.PI * 2); ctx.fill(); }
    if (e.sparkle) {
        ctx.save(); ctx.translate(ir * .3, iy - ir * .45); ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? .06 : .2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    // Contour + paupière
    ctx.strokeStyle = ink; ctx.lineWidth = .1; eyePath(ctx, e); ctx.stroke();
    const w = e.w || 1, tilt = e.tilt || 0;
    ctx.lineWidth = e.lid ? .34 : .2;
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, -2 * e.t, w, tilt); ctx.stroke();
    if (e.lash) {
        ctx.lineWidth = .13;
        for (let i = 0; i < e.lash; i++) {
            const k = .55 + i * .2;
            const x = w * k, y = tilt * k - 2 * e.t * (1 - k) * k * 1.05;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .28, y - .26 + i * .08); ctx.stroke();
        }
    }
    if (e.low) { ctx.lineWidth = .1; for (let i = 0; i < 2; i++) { const x = .35 + i * .3; ctx.beginPath(); ctx.moveTo(x, e.b * .9); ctx.lineTo(x + .12, e.b * .9 + .25); ctx.stroke(); } }
    if (e.bags) { ctx.lineWidth = .08; ctx.strokeStyle = rgba(ink, .6); ctx.beginPath(); ctx.moveTo(-.6, e.b + .25); ctx.quadraticCurveTo(0, e.b + .55, .6, e.b + .25); ctx.stroke(); }
    if (e.angry) { ctx.lineWidth = .22; ctx.beginPath(); ctx.moveTo(-1.05, -.55); ctx.lineTo(.9, -.95); ctx.stroke(); }
}

/* ---------------- SOURCILS ---------------- */
const BROWS = [
    { c: .25, w: [.28, .3, .18] },
    { c: .45, w: [.16, .18, .08] },
    { c: .05, w: [.4, .4, .35] },
    { c: .1, slope: -.35, w: [.35, .3, .2] },
    { c: .15, slope: .35, w: [.3, .25, .15] },
    { c: .2, w: [.32, .32, .26], len: .6 },
    { c: .2, w: [.52, .52, .42], rough: true },
    { c: 0, w: [.22, .22, .22], len: .5 },
    { c: .7, w: [.2, .24, .1] },
    { c: .3, w: [.46, .26, .05] },
    { c: .35, w: [.42, .44, .3] },
    { special: 'dots' },
    { special: 'wave', w: [.2, .2, .14] },
    { c: .18, w: [.3, .3, .18], inner: 1.5 },
];

function drawBrowUnit(ctx, type, color) {
    const b = BROWS[type] || BROWS[0];
    ctx.fillStyle = color;
    if (b.special === 'dots') {
        ctx.beginPath(); ctx.ellipse(-.45, 0, .28, .2, 0, 0, Math.PI * 2); ctx.ellipse(.35, -.05, .22, .16, 0, 0, Math.PI * 2); ctx.fill();
        return;
    }
    const len = b.len || 1, x0 = -len * (b.inner || 1), x1 = len;
    const N = 24, top = [], bot = [];
    for (let i = 0; i <= N; i++) {
        const u = i / N, x = x0 + (x1 - x0) * u;
        const xn = (x - (x0 + x1) / 2) / ((x1 - x0) / 2);
        let y = -(b.c || 0) * (1 - xn * xn) + (b.slope || 0) * xn * .5;
        if (b.special === 'wave') y = Math.sin(u * Math.PI * 2) * .12 - .1;
        const w = u < .5 ? b.w[0] + (b.w[1] - b.w[0]) * u * 2 : b.w[1] + (b.w[2] - b.w[1]) * (u - .5) * 2;
        top.push([x, y - w / 2]); bot.push([x, y + w / 2]);
    }
    ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath(); ctx.fill();
    if (b.rough) {
        ctx.strokeStyle = color; ctx.lineWidth = .06; ctx.lineCap = 'round';
        for (let i = 2; i < N - 1; i += 2) { const [x, y] = top[i]; ctx.beginPath(); ctx.moveTo(x, y + .05); ctx.lineTo(x + .1, y - .12); ctx.stroke(); }
    }
}

/* ---------------- BOUCHE ---------------- */
function drawMouthUnit(ctx, type, lip, blink) {
    const line = shade(lip, -.55);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = line; ctx.lineWidth = .14;
    const stroke = (fn) => { ctx.beginPath(); fn(); ctx.stroke(); };
    const fill = (c, fn) => { ctx.fillStyle = c; ctx.beginPath(); fn(); ctx.fill(); };
    const open = (h, teeth, tongue) => {
        const path = () => { ctx.moveTo(-.9, -.1); ctx.quadraticCurveTo(0, .05, .9, -.1); ctx.quadraticCurveTo(0, h * 2, -.9, -.1); ctx.closePath(); };
        fill('#5a1c1c', path);
        ctx.save(); ctx.beginPath(); path(); ctx.clip();
        if (teeth) fill('#fff', () => ctx.rect(-1, -.2, 2, .26));
        if (tongue) fill('#e8707a', () => ctx.ellipse(0, h * 1.05, .45, .3, 0, 0, Math.PI * 2));
        ctx.restore();
        ctx.strokeStyle = line; ctx.lineWidth = .1; ctx.beginPath(); path(); ctx.stroke();
    };
    switch (type) {
        case 0: stroke(() => { ctx.moveTo(-.8, -.1); ctx.quadraticCurveTo(0, .45, .8, -.1); }); break;
        case 1: open(.75, true, false); break;
        case 2: fill(line, () => ctx.ellipse(0, .05, .22, .26, 0, 0, Math.PI * 2)); fill('#7a2a2a', () => ctx.ellipse(0, .07, .14, .17, 0, 0, Math.PI * 2)); break;
        case 3: stroke(() => { ctx.moveTo(-.65, .05); ctx.lineTo(.65, .05); }); break;
        case 4: stroke(() => { ctx.moveTo(-.7, .08); ctx.quadraticCurveTo(.2, .2, .75, -.22); }); break;
        case 5: stroke(() => { ctx.moveTo(-.75, .2); ctx.quadraticCurveTo(0, -.3, .75, .2); }); break;
        case 6: {
            fill(lip, () => { ctx.moveTo(-.8, 0); ctx.quadraticCurveTo(-.4, -.32, 0, -.14); ctx.quadraticCurveTo(.4, -.32, .8, 0); ctx.quadraticCurveTo(0, .5, -.8, 0); });
            stroke(() => { ctx.moveTo(-.78, 0); ctx.quadraticCurveTo(0, .12, .78, 0); });
            fill('rgba(255,255,255,.35)', () => ctx.ellipse(.15, .2, .18, .06, 0, 0, Math.PI * 2));
            break;
        }
        case 7: open(.85, true, true); break;
        case 8: stroke(() => { ctx.moveTo(-.6, -.05); ctx.quadraticCurveTo(-.3, .35, 0, 0); ctx.quadraticCurveTo(.3, .35, .6, -.05); }); break;
        case 9: {
            const p = () => { ctx.moveTo(-.85, -.1); ctx.quadraticCurveTo(0, .0, .85, -.1); ctx.quadraticCurveTo(0, .6, -.85, -.1); ctx.closePath(); };
            fill('#fff', p); ctx.lineWidth = .1; stroke(p);
            ctx.lineWidth = .05; stroke(() => { ctx.moveTo(-.8, .07); ctx.quadraticCurveTo(0, .2, .8, .07); });
            for (let x = -.5; x <= .5; x += .25) stroke(() => { ctx.moveTo(x, -.05); ctx.lineTo(x, .25); });
            break;
        }
        case 10: fill(lip, () => ctx.ellipse(0, .05, .34, .22, 0, 0, Math.PI * 2)); stroke(() => { ctx.moveTo(-.3, .05); ctx.lineTo(.3, .05); }); break;
        case 11: stroke(() => { ctx.moveTo(-.95, -.15); ctx.quadraticCurveTo(0, .55, .95, -.15); }); ctx.lineWidth = .08; stroke(() => { ctx.moveTo(-1.05, -.3); ctx.lineTo(-.95, -.08); }); stroke(() => { ctx.moveTo(1.05, -.3); ctx.lineTo(.95, -.08); }); break;
        case 12: fill('#5a1c1c', () => ctx.ellipse(0, .1, .32, .45, 0, 0, Math.PI * 2)); ctx.lineWidth = .1; stroke(() => ctx.ellipse(0, .1, .32, .45, 0, 0, Math.PI * 2)); break;
        case 13: {
            fill('#e8707a', () => { ctx.ellipse(.2, .28, .26, .3, 0, 0, Math.PI * 2); });
            stroke(() => { ctx.moveTo(-.75, -.05); ctx.quadraticCurveTo(0, .3, .75, -.05); });
            break;
        }
        default: stroke(() => { ctx.moveTo(-.8, -.1); ctx.quadraticCurveTo(0, .45, .8, -.1); });
    }
}

/* ---------------- MOUSTACHE ---------------- */
function drawMustacheUnit(ctx, type, color) {
    ctx.fillStyle = color; ctx.beginPath();
    switch (type) {
        case 1: // chevron
            ctx.moveTo(0, -.2); ctx.quadraticCurveTo(.6, -.35, .95, .25); ctx.quadraticCurveTo(.5, .15, 0, .2);
            ctx.quadraticCurveTo(-.5, .15, -.95, .25); ctx.quadraticCurveTo(-.6, -.35, 0, -.2); break;
        case 2: // guidon
            ctx.moveTo(0, -.15); ctx.quadraticCurveTo(.5, -.3, .8, 0); ctx.quadraticCurveTo(1.05, .15, 1.15, -.3);
            ctx.quadraticCurveTo(1.15, .3, .75, .2); ctx.quadraticCurveTo(.4, .1, 0, .15);
            ctx.quadraticCurveTo(-.4, .1, -.75, .2); ctx.quadraticCurveTo(-1.15, .3, -1.15, -.3);
            ctx.quadraticCurveTo(-1.05, .15, -.8, 0); ctx.quadraticCurveTo(-.5, -.3, 0, -.15); break;
        case 3: // fine
            ctx.moveTo(-.8, .05); ctx.quadraticCurveTo(0, -.15, .8, .05); ctx.quadraticCurveTo(0, -.02, -.8, .05); break;
        case 4: // morse
            ctx.moveTo(0, -.3); ctx.quadraticCurveTo(.8, -.4, 1.0, .5); ctx.quadraticCurveTo(.5, .35, 0, .4);
            ctx.quadraticCurveTo(-.5, .35, -1.0, .5); ctx.quadraticCurveTo(-.8, -.4, 0, -.3); break;
        case 5: // brosse
            ctx.rect(-.32, -.2, .64, .36); break;
        case 6: // fer à cheval
            ctx.moveTo(-.9, -.15); ctx.quadraticCurveTo(0, -.35, .9, -.15); ctx.lineTo(1.0, 1.6); ctx.lineTo(.78, 1.6);
            ctx.lineTo(.68, .15); ctx.quadraticCurveTo(0, 0, -.68, .15); ctx.lineTo(-.78, 1.6); ctx.lineTo(-1.0, 1.6); ctx.closePath(); break;
        default: return;
    }
    ctx.fill();
}

/* ---------------- BARBE (sur la texture) ---------------- */
function drawBeard(ctx, type, color, seed) {
    if (!type) return;
    const S = FACE_TEX;
    ctx.save();
    const jaw = () => { ctx.moveTo(70, 250); ctx.bezierCurveTo(80, 440, 170, 512, 256, 512); ctx.bezierCurveTo(342, 512, 432, 440, 442, 250); };
    if (type === 1) { // barbe de 3 jours
        ctx.fillStyle = rgba(color, .28);
        ctx.beginPath(); jaw(); ctx.lineTo(400, 300); ctx.quadraticCurveTo(256, 300, 112, 300); ctx.closePath(); ctx.fill();
        const r = rng(seed);
        ctx.fillStyle = rgba(color, .35);
        for (let i = 0; i < 380; i++) { const x = 90 + r() * 332, y = 300 + r() * 200; if (Math.hypot((x - 256) / 180, (y - 300) / 210) < 1) ctx.fillRect(x, y, 2, 2); }
    } else if (type === 2) { // bouc
        ctx.fillStyle = color; ctx.beginPath();
        ctx.moveTo(200, 410); ctx.quadraticCurveTo(256, 400, 312, 410); ctx.quadraticCurveTo(310, 500, 256, 508); ctx.quadraticCurveTo(202, 500, 200, 410); ctx.fill();
    } else if (type === 3) { // collier
        ctx.strokeStyle = color; ctx.lineWidth = 26; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(84, 250); ctx.bezierCurveTo(95, 430, 175, 498, 256, 498); ctx.bezierCurveTo(337, 498, 417, 430, 428, 250); ctx.stroke();
    } else if (type === 4 || type === 6) { // pleine
        ctx.fillStyle = color; ctx.beginPath(); jaw();
        ctx.lineTo(410, 280); ctx.bezierCurveTo(400, 330, 340, 345, 256, 345); ctx.bezierCurveTo(172, 345, 112, 330, 102, 280); ctx.closePath(); ctx.fill();
    } else if (type === 5) { // mouche
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(240, 420); ctx.lineTo(272, 420); ctx.lineTo(256, 456); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    void S;
}

/* ---------------- TRAITS / MAQUILLAGE ---------------- */
function drawFeature(ctx, type, skin, seed) {
    const ink = rgba(shade(skin, -.55), .55);
    const blush = (a) => {
        for (const cx of [150, 362]) {
            const g = ctx.createRadialGradient(cx, 285, 4, cx, 285, 42);
            g.addColorStop(0, `rgba(255,110,120,${a})`); g.addColorStop(1, 'rgba(255,110,120,0)');
            ctx.fillStyle = g; ctx.fillRect(cx - 50, 235, 100, 100);
        }
    };
    const freckles = () => {
        const r = rng(seed + 7); ctx.fillStyle = rgba(shade(skin, -.45), .7);
        for (const cx of [160, 352]) for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(cx - 28 + r() * 56, 262 + r() * 34, 2.4 + r() * 1.5, 0, Math.PI * 2); ctx.fill(); }
    };
    ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const line = (fn) => { ctx.beginPath(); fn(); ctx.stroke(); };
    switch (type) {
        case 1: blush(.5); break;
        case 2: freckles(); break;
        case 3: for (const cx of [196, 316]) line(() => { ctx.moveTo(cx - 22, 240); ctx.quadraticCurveTo(cx, 256, cx + 22, 240); }); break;
        case 4: line(() => { ctx.moveTo(214, 300); ctx.quadraticCurveTo(196, 340, 206, 370); }); line(() => { ctx.moveTo(298, 300); ctx.quadraticCurveTo(316, 340, 306, 370); }); break;
        case 5: for (let i = 0; i < 3; i++) line(() => { ctx.moveTo(200, 70 + i * 16); ctx.quadraticCurveTo(256, 62 + i * 16, 312, 70 + i * 16); }); break;
        case 6: for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) line(() => { const x = 256 + s * 118; ctx.moveTo(x, 205 + i * 12); ctx.lineTo(x + s * 18, 200 + i * 18); }); break;
        case 7: {
            ctx.fillStyle = 'rgba(70,80,90,.18)'; ctx.beginPath();
            ctx.moveTo(80, 260); ctx.bezierCurveTo(90, 440, 175, 510, 256, 510); ctx.bezierCurveTo(337, 510, 422, 440, 432, 260);
            ctx.bezierCurveTo(400, 340, 330, 345, 256, 345); ctx.bezierCurveTo(182, 345, 112, 340, 80, 260); ctx.fill(); break;
        }
        case 8: {
            for (const cx of [196, 316]) {
                const g = ctx.createRadialGradient(cx, 186, 2, cx, 186, 40);
                g.addColorStop(0, 'rgba(120,80,200,.55)'); g.addColorStop(1, 'rgba(120,80,200,0)');
                ctx.fillStyle = g; ctx.fillRect(cx - 45, 140, 90, 70);
            }
            break;
        }
        case 9: for (const cx of [196, 316]) { ctx.fillStyle = 'rgba(90,60,90,.18)'; ctx.beginPath(); ctx.ellipse(cx, 238, 30, 12, 0, 0, Math.PI * 2); ctx.fill(); } break;
        case 10: blush(.45); freckles(); break;
        case 11:
            for (let i = 0; i < 2; i++) line(() => { ctx.moveTo(210, 78 + i * 16); ctx.quadraticCurveTo(256, 70 + i * 16, 302, 78 + i * 16); });
            line(() => { ctx.moveTo(214, 300); ctx.quadraticCurveTo(196, 340, 206, 370); }); line(() => { ctx.moveTo(298, 300); ctx.quadraticCurveTo(316, 340, 306, 370); });
            for (const cx of [196, 316]) line(() => { ctx.moveTo(cx - 20, 242); ctx.quadraticCurveTo(cx, 254, cx + 20, 242); });
            break;
    }
    ctx.restore();
}

/* ---------------- Paramètres de placement (partagés avec la 3D) ----------------
   Le y du canvas descend vers le bas : « + » sur un curseur de hauteur doit remonter la pièce. */
export const layout = {
    eye: (m) => ({ dx: 36 + m.eyes.spacing * 5, y: 200 - (m.eyes.y - 9) * 5, s: 30 * (.62 + .1 * m.eyes.size), rot: (m.eyes.rot - 3) * .09 }),
    brow: (m) => ({ dx: 38 + m.brows.spacing * 5, y: 142 - (m.brows.y - 9) * 5, s: 28 * (.6 + .1 * m.brows.size), rot: (m.brows.rot - 6) * .07 }),
    nose: (m) => ({ y: 288 - (m.nose.y - 9) * 5, s: .6 + .1 * m.nose.size }),
    mouth: (m) => ({ y: 375 - (m.mouth.y - 9) * 5, s: 40 * (.6 + .1 * m.mouth.size) }),
    mustache: (m) => ({ y: 336 - (m.mustache.y - 8) * 4, s: 40 * (.6 + .1 * m.mustache.size) }),
    glasses: (m) => ({ y: 200 - (m.glasses.y - 10) * 5, s: .7 + .1 * m.glasses.size }),
    mole: (m) => ({ x: 256 + (m.mole.x - 8) * 14, y: 440 - m.mole.y * 11, r: 3 + m.mole.size * .9 }),
};

function seedOf(m) { let h = 0; for (const c of String(m.id)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

/**
 * Dessine tout le visage. opts.blink = yeux fermés ; opts.only = 'eyes'|'brows'|'mouth'|... pour les vignettes.
 */
export function drawFace(ctx, m, opts = {}) {
    const S = FACE_TEX, seed = seedOf(m);
    ctx.clearRect(0, 0, S, S);
    drawFeature(ctx, m.face.feature, m.face.skin, seed);
    drawBeard(ctx, m.beard.type, m.facialHairColor, seed);

    if (m.mole.on) {
        const p = layout.mole(m);
        ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    const mo = layout.mouth(m);
    ctx.save(); ctx.translate(256, mo.y); ctx.scale(mo.s * 1.15, mo.s); drawMouthUnit(ctx, m.mouth.type, m.mouth.color, opts.blink); ctx.restore();

    if (m.mustache.type) {
        const mu = layout.mustache(m);
        ctx.save(); ctx.translate(256, mu.y); ctx.scale(mu.s, mu.s * .8); drawMustacheUnit(ctx, m.mustache.type, m.facialHairColor); ctx.restore();
    }

    const ey = layout.eye(m);
    for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(256 + side * ey.dx, ey.y); ctx.scale(side, 1); ctx.rotate(-ey.rot); ctx.scale(ey.s, ey.s);
        drawEyeUnit(ctx, m.eyes.type, m.eyes.color, opts.blink); ctx.restore();
    }

    const br = layout.brow(m);
    for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(256 + side * br.dx, br.y); ctx.scale(side, 1); ctx.rotate(-br.rot); ctx.scale(br.s, br.s);
        drawBrowUnit(ctx, m.brows.type, m.brows.color); ctx.restore();
    }
}

/* Vignettes 2D d'une seule pièce (utilisées pour les grilles de choix) */
export function drawPartIcon(ctx, part, type, m, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.save(); ctx.translate(size / 2, size / 2);
    const k = size / 4;
    if (part === 'eyes') { ctx.scale(k * 1.2, k * 1.2); drawEyeUnit(ctx, type, m.eyes.color, false); }
    else if (part === 'brows') { ctx.scale(k * 1.3, k * 1.3); drawBrowUnit(ctx, type, m.brows.color); }
    else if (part === 'mouth') { ctx.scale(k * 1.4, k * 1.4); drawMouthUnit(ctx, type, m.mouth.color); }
    else if (part === 'mustache') { ctx.translate(0, -k * .4); ctx.scale(k * 1.4, k * 1.2); drawMustacheUnit(ctx, type, m.facialHairColor); }
    ctx.restore();
}
