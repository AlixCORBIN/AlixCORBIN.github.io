/* =========================================
   CHAÎNE MÉTÉO : scène animée (canvas sous le panneau)
   Ambiances : clear, clouds, rain, drizzle, storm, snow, fog, wind, de jour ou de nuit.
   Interactions :
     - parallaxe des nuages, du soleil et des collines selon le curseur
     - pluie : les gouttes glissent autour du curseur comme sur un parapluie
     - neige : les flocons s'écartent, la neige s'accumule au sol
     - brouillard : le curseur le dissipe, il revient doucement
     - vent : les feuilles évitent le curseur, clic = rafale
     - clic : éclair (orage), étoile filante (nuit dégagée), envol d'oiseaux (jour dégagé)
   prefers-reduced-motion : une image fixe, aucune animation.
   API : window.MeteoScene.start(overlayEl, cfg) / set(cfg) / stop() / fromWeather(d) / preset(kind, night)
   ========================================= */
(function () {
    'use strict';

    const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const TAU = Math.PI * 2;

    // [ciel haut, ciel bas, colline loin, colline près, nuage, ombre de nuage, précipitations, brume]
    const PAL = {
        clear:   [['#3d8fd6', '#a6d6f2', '#8db58a', '#5f8f5f', '#ffffff', '#dbe7f0', '#ffffff', '#ffffff'],
                  ['#071027', '#1a2a4a', '#1b283a', '#0f1826', '#2c3a52', '#222e44', '#ffffff', '#3a4660']],
        clouds:  [['#6b8fb0', '#c4d6e4', '#86a588', '#5c8060', '#f7f9fb', '#c9d5df', '#ffffff', '#eef2f5'],
                  ['#0d1626', '#25334a', '#1a2533', '#101822', '#36435a', '#2a3549', '#ffffff', '#3a4558']],
        rain:    [['#4a5c6c', '#8c9dac', '#5b7363', '#425849', '#8f9ca8', '#727f8b', '#dce6ee', '#aab5bf'],
                  ['#0c131d', '#222e3c', '#17202a', '#0e141b', '#3a4553', '#2c3542', '#9fb0c2', '#3a4452']],
        drizzle: [['#6a7d8d', '#aab8c4', '#6f8a75', '#55705c', '#b2bdc7', '#959fa9', '#eef3f7', '#c3cbd2'],
                  ['#111a26', '#2a3646', '#1b2530', '#121a22', '#414c5b', '#333d4a', '#a9b8c8', '#3e4856']],
        storm:   [['#1e252f', '#434e5b', '#2b3631', '#1d2622', '#4a5461', '#363f4b', '#c9d4de', '#5a6470'],
                  ['#080b11', '#1a2029', '#12171c', '#0b0e12', '#2a313b', '#1f252d', '#9aa7b5', '#2a313b']],
        snow:    [['#94abc0', '#dfe7ee', '#e6ecf1', '#cfd8e0', '#f2f5f8', '#d3dbe3', '#ffffff', '#eef2f5'],
                  ['#101a2a', '#2b3850', '#3a4559', '#2a3446', '#4a566c', '#3b465a', '#e8eef6', '#4a566c']],
        fog:     [['#9ea8b0', '#d3d8db', '#98a49d', '#7f8b84', '#e2e5e7', '#c9ced2', '#ffffff', '#e8ebed'],
                  ['#1a2029', '#363e49', '#262d36', '#1b2128', '#444c57', '#383f49', '#ffffff', '#505864']],
        wind:    [['#5d93c4', '#b7d7ec', '#88ab7c', '#62875a', '#f3f6f9', '#ccd7e0', '#ffffff', '#ffffff'],
                  ['#0d1626', '#25334a', '#1a2533', '#101822', '#36435a', '#2a3549', '#ffffff', '#3a4558']]
    };
    const LIGHT_DAY = ['clear', 'clouds', 'snow', 'fog', 'wind', 'drizzle'];
    const LEAF = ['#b9782f', '#8a9a3c', '#c9a23a', '#a5552a'];
    const SUN = '#ffcf4d';
    const MOON = '#ece6d2';

    let host = null, cv = null, ctx = null, W = 0, H = 0, DPR = 1;
    let raf = 0, lastT = 0, S = null, fadeC = null, fade = 0;
    const ptr = { x: -9999, y: -9999, nx: 0.5, ny: 0.5, px: 0.5, py: 0.5, in: false, lx: null, ly: null };

    /* ---------- Données → ambiance ---------- */
    function kindFromId(id) {
        if (id >= 200 && id < 300) return 'storm';
        if (id >= 300 && id < 400) return 'drizzle';
        if (id >= 500 && id < 600) return 'rain';
        if (id >= 600 && id < 700) return 'snow';
        if (id === 771 || id === 781) return 'wind';
        if (id >= 700 && id < 800) return 'fog';
        if (id > 800) return 'clouds';
        return 'clear';
    }

    function isNightNow() {
        const h = new Date().getHours();
        return h < 7 || h >= 20;
    }

    function fromWeather(d) {
        const w = (d && d.weather && d.weather[0]) || {};
        const id = w.id || 800;
        const now = d.dt || Date.now() / 1000;
        const night = d.sys && d.sys.sunrise ? (now < d.sys.sunrise || now > d.sys.sunset) : isNightNow();
        const wind = (d.wind && d.wind.speed) || 0;
        let cover = ((d.clouds && d.clouds.all) || 0) / 100;
        let kind = kindFromId(id), intensity = 0.6;
        if (kind === 'storm') intensity = (id === 202 || id === 212 || id === 221) ? 1 : 0.8;
        if (kind === 'drizzle') intensity = id >= 302 ? 0.5 : 0.3;
        if (kind === 'rain') intensity = id === 500 ? 0.4 : id === 501 ? 0.6 : (id >= 502 && id <= 504) ? 0.95 : 0.7;
        if (kind === 'snow') intensity = (id === 600 || id === 620) ? 0.4 : (id === 602 || id === 622) ? 1 : 0.65;
        if (kind === 'fog') intensity = id === 701 ? 0.6 : 0.85;
        if (kind === 'wind') intensity = 1;
        if (kind === 'clouds') cover = Math.max(cover, (id - 800) * 0.22);
        if (kind === 'clear' && wind >= 11) kind = 'wind';
        return { kind, night, wind, cover, intensity };
    }

    function preset(kind, night) {
        const c = { kind, night: !!night, wind: 3, cover: 0.2, intensity: 0.6 };
        if (kind === 'clouds') c.cover = 0.7;
        if (kind === 'rain') c.intensity = 0.65;
        if (kind === 'drizzle') c.intensity = 0.35;
        if (kind === 'storm') { c.intensity = 0.95; c.wind = 8; }
        if (kind === 'snow') c.intensity = 0.65;
        if (kind === 'fog') c.intensity = 0.85;
        if (kind === 'wind') { c.wind = 14; c.cover = 0.4; c.intensity = 1; }
        return c;
    }

    const isLight = cfg => !cfg.night && LIGHT_DAY.includes(cfg.kind);
    const sameCfg = (a, b) => a && b && a.kind === b.kind && a.night === b.night &&
        Math.abs(a.wind - b.wind) < 0.5 && Math.abs(a.cover - b.cover) < 0.05 && Math.abs(a.intensity - b.intensity) < 0.05;

    /* ---------- Petits outils de dessin ---------- */
    function canvas(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(w));
        c.height = Math.max(1, Math.ceil(h));
        return c;
    }

    function rgba(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
    }

    // Tache douce (bords fondus) : sert au brouillard et à la gomme qui le dissipe
    function softSprite(hex) {
        const c = canvas(128, 128), g = c.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, rgba(hex, 1));
        gr.addColorStop(0.55, rgba(hex, 0.55));
        gr.addColorStop(1, rgba(hex, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
        return c;
    }

    // Nuage en deux aplats (ombre dessous, corps dessus) : bosses sur une base de cercles réguliers, fond plat
    function makeCloud(w, main, shade) {
        const h = w * 0.5;
        const c = canvas(w, h), g = c.getContext('2d');
        const base = h * 0.84;
        const r0 = h * 0.17;
        const circles = [];
        const nb = 5;
        for (let i = 0; i < nb; i++) circles.push([w * (0.16 + 0.68 * i / (nb - 1)), base - r0, r0]);
        const n = 3 + (Math.random() * 3 | 0);
        for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n;
            const r = w * rand(0.12, 0.19) * (1 - Math.abs(t - 0.5) * 0.7);
            circles.push([w * (0.22 + 0.56 * t) + rand(-0.03, 0.03) * w, base - r0 - r * rand(0.35, 0.7), r]);
        }
        const shape = (dy, col) => {
            g.fillStyle = col;
            g.beginPath();
            for (const [x, y, r] of circles) {
                g.moveTo(x + r, y + dy);
                g.arc(x, y + dy, r, 0, TAU);
            }
            g.fill();
        };
        shape(0, shade);
        shape(-h * 0.06, main);
        g.clearRect(0, base, w, h - base);
        return c;
    }

    function hillSeed() {
        return { p: [rand(0, TAU), rand(0, TAU), rand(0, TAU)] };
    }

    function hillY(seed, x, base, amps, freqs) {
        let y = H * base;
        for (let i = 0; i < 3; i++) y += H * amps[i] * Math.sin((x / W) * freqs[i] * TAU + seed.p[i]);
        return y;
    }

    /* ---------- Construction d'une scène ---------- */
    function windPx(s) {
        return clamp(s.cfg.wind * 22, 0, 320) + (s.cfg.kind === 'storm' ? 60 : 0);
    }

    function newDrop(s, scatter) {
        const z = rand(0.35, 1);
        const drizzle = s.cfg.kind === 'drizzle';
        return {
            x: rand(-0.2 * W, 1.05 * W), y: scatter ? rand(-H, H) : rand(-0.25 * H, -10), z,
            len: (drizzle ? rand(6, 10) : rand(14, 26)) * (0.6 + z * 0.6),
            vy: (drizzle ? 480 : 950) * (0.6 + z * 0.55),
            gy: H * rand(0.84, 1.02)
        };
    }

    function newFlake(scatter) {
        const z = rand(0.3, 1);
        return { x: rand(-0.1 * W, 1.1 * W), y: scatter ? rand(-H, H) : rand(-0.2 * H, -5), z, r: 0.8 + z * 2.6, ph: rand(0, TAU), vx: 0, vy: 0 };
    }

    function newLeaf(scatter) {
        return {
            x: scatter ? rand(0, W) : rand(-0.3 * W, -20), y: rand(0.1, 0.95) * H,
            s: rand(5, 9), rot: rand(0, TAU), vr: rand(-6, 6), ph: rand(0, TAU),
            col: LEAF[Math.random() * LEAF.length | 0], vx: 0, vy: 0, sp: rand(0.7, 1.25)
        };
    }

    function newStreak(scatter) {
        const len = rand(80, 220);
        return { x: scatter ? rand(-len, W) : -len - rand(0, W * 0.5), y: rand(0.08, 0.9) * H, len, sp: rand(600, 1000), a: rand(0.1, 0.25) };
    }

    function makeFog(pal, intensity) {
        const fw = Math.max(64, Math.round(W / 3)), fh = Math.max(64, Math.round(H / 3));
        const layer = canvas(fw, fh), wipe = canvas(fw, fh);
        const bands = [];
        for (let i = 0; i < 9; i++) {
            bands.push({ x: rand(-0.3, 1) * fw, y: fh * rand(0.25, 1), w: fw * rand(0.6, 1.3), h: fh * rand(0.14, 0.32), sp: rand(2, 7) * (Math.random() < 0.5 ? -1 : 1), a: rand(0.4, 0.75) });
        }
        return { fw, fh, layer, lctx: layer.getContext('2d'), wipe, wctx: wipe.getContext('2d'), sprite: softSprite(pal[7]), brush: softSprite('#000000'), bands, intensity };
    }

    function build(cfg) {
        const pal = PAL[cfg.kind][cfg.night ? 1 : 0];
        const area = (W * H) / (1400 * 780);
        const s = {
            cfg, pal, t: 0, area,
            clouds: [], drops: [], splashes: [], flakes: [], stars: [], leaves: [], streaks: [], birds: [], bolts: [],
            flash: 0, nextBolt: rand(1.2, 3.5), nextShoot: rand(4, 10), shoot: null, nextFlock: rand(2, 6), sunHover: 0,
            hills: [hillSeed(), hillSeed()], snowH: null, fog: null
        };

        // Nuages : nombre, bande de hauteur et taille selon l'ambiance
        let n, band, big;
        switch (cfg.kind) {
            case 'clear': n = cfg.night ? 1 : 3; band = [0.08, 0.32]; big = 0.7; break;
            case 'clouds': n = 3 + Math.round(cfg.cover * 9); band = [0.04, 0.42]; big = 1; break;
            case 'wind': n = 7; band = [0.05, 0.4]; big = 0.9; break;
            case 'fog': n = 4; band = [0.05, 0.3]; big = 1.1; break;
            default: n = 13; band = [-0.07, 0.3]; big = 1.35;
        }
        n = Math.round(n * clamp(Math.sqrt(area), 0.6, 1.4));
        for (let i = 0; i < n; i++) {
            const depth = rand(0.45, 1);
            const w = clamp(W * rand(0.16, 0.3) * big * (0.6 + depth * 0.5), 110, 760);
            s.clouds.push({ img: makeCloud(w, pal[4], pal[5]), w, h: w * 0.5, x: rand(-w, W), y: H * rand(band[0], band[1]), depth });
        }
        s.clouds.sort((a, b) => a.depth - b.depth);

        if (cfg.night && ['clear', 'clouds', 'wind'].includes(cfg.kind)) {
            const ns = Math.round(160 * area * (cfg.kind === 'clear' ? 1 : 0.45));
            for (let i = 0; i < ns; i++) s.stars.push({ x: rand(0, W), y: rand(0, H * 0.68), r: rand(0.5, 1.5), ph: rand(0, TAU), sp: rand(0.5, 2) });
        }

        if (['rain', 'drizzle', 'storm'].includes(cfg.kind)) {
            const k = cfg.kind === 'drizzle' ? 380 : 720;
            const nd = Math.round(clamp(k * cfg.intensity * area, 60, 1000));
            for (let i = 0; i < nd; i++) s.drops.push(newDrop(s, true));
        }

        if (cfg.kind === 'snow') {
            const nf = Math.round(clamp(320 * cfg.intensity * area, 60, 560));
            for (let i = 0; i < nf; i++) s.flakes.push(newFlake(true));
            s.snowH = new Float32Array(Math.ceil(W / 8) + 2);
            for (let i = 0; i < s.snowH.length; i++) s.snowH[i] = H * 0.012 + Math.sin(i * 0.35) * 2;
        }

        if (cfg.kind === 'wind') {
            const nl = Math.round(clamp(24 * area, 10, 40));
            for (let i = 0; i < nl; i++) s.leaves.push(newLeaf(true));
        }
        const nStreaks = cfg.kind === 'wind' ? 16 : cfg.wind >= 9 ? 7 : 0;
        for (let i = 0; i < nStreaks; i++) s.streaks.push(newStreak(true));

        if (cfg.kind === 'fog') s.fog = makeFog(pal, cfg.intensity);
        return s;
    }

    /* ---------- Effets déclenchés ---------- */
    function splash(s, x, y, z) {
        if (s.splashes.length > 160) return;
        s.splashes.push({ x, y, r: 0, max: rand(3, 8) * (0.5 + z), life: 1 });
    }

    function jag(x0, y0, x1, y1, n, amp) {
        const pts = [[x0, y0]];
        const L = Math.hypot(x1 - x0, y1 - y0);
        for (let i = 1; i < n; i++) {
            const t = i / n;
            pts.push([x0 + (x1 - x0) * t + rand(-1, 1) * L * amp, y0 + (y1 - y0) * t + rand(-0.3, 0.3) * L / n]);
        }
        pts.push([x1, y1]);
        return pts;
    }

    function strike(s, x, y) {
        const x0 = x + rand(-0.08, 0.08) * W, y0 = H * rand(0.06, 0.16);
        const main = jag(x0, y0, x, y, 16, 0.07);
        const branches = [];
        const nb = 1 + (Math.random() * 3 | 0);
        for (let i = 0; i < nb; i++) {
            const p = main[3 + (Math.random() * (main.length - 7) | 0)];
            const len = rand(0.1, 0.22) * H;
            const ang = rand(0.35, 0.9) * (Math.random() < 0.5 ? -1 : 1);
            branches.push(jag(p[0], p[1], p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len, 7, 0.1));
        }
        s.bolts.push({ main, branches, life: 0.5 });
        s.flash = Math.max(s.flash, 0.55);
    }

    function flock(s, x, y, burst) {
        const n = burst ? 6 : 3 + (Math.random() * 4 | 0);
        for (let i = 0; i < n; i++) {
            s.birds.push({
                x: x + rand(-30, 30), y: y + rand(-18, 18),
                vx: burst ? rand(70, 170) * (Math.random() < 0.5 ? -1 : 1) : rand(45, 75),
                vy: burst ? rand(-130, -60) : rand(-5, 5),
                ph: rand(0, TAU), size: rand(5, 8), burst
            });
        }
    }

    function shoot(s, x, y) {
        s.shoot = { x, y, vx: -rand(520, 720), vy: rand(220, 320), life: 0.9 };
    }

    function push(list, x, y, R, force) {
        for (const p of list) {
            const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
            if (d < R && d > 0.01) {
                const f = (1 - d / R) * force;
                p.vx += dx / d * f;
                p.vy += dy / d * f;
            }
        }
    }

    /* ---------- Mise à jour ---------- */
    function update(s, dt) {
        s.t += dt;
        const k = s.cfg.kind;

        for (const c of s.clouds) {
            c.x += (8 + s.cfg.wind * 4) * c.depth * (k === 'wind' ? 2.2 : 1) * dt;
            if (c.x > W + 60) c.x = -c.w - rand(0, W * 0.3);
        }

        // Pluie, bruine, orage
        if (s.drops.length) {
            const vx0 = windPx(s), R = 80, R2 = R * R;
            for (const d of s.drops) {
                d.x += vx0 * d.z * dt;
                d.y += d.vy * dt;
                if (ptr.in) {
                    const dx = d.x - ptr.x, dy = d.y - ptr.y;
                    if (dy < 8 && dx * dx + dy * dy < R2) {
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        d.x = ptr.x + dx / dist * R;
                        d.y = ptr.y + dy / dist * R;
                        if (Math.random() < 0.04) splash(s, d.x, d.y, d.z * 0.6);
                    }
                }
                if (d.y >= d.gy) {
                    if (d.gy < H && Math.random() < 0.45) splash(s, d.x, d.gy, d.z);
                    Object.assign(d, newDrop(s, false));
                }
            }
        }
        for (const p of s.splashes) {
            p.r += p.max * 4 * dt;
            p.life -= dt * 3;
        }
        s.splashes = s.splashes.filter(p => p.life > 0);

        if (k === 'storm') {
            s.nextBolt -= dt;
            if (s.nextBolt <= 0) {
                strike(s, rand(0.1, 0.9) * W, H * rand(0.72, 0.88));
                s.nextBolt = rand(3, 9);
            }
        }
        for (const b of s.bolts) b.life -= dt;
        s.bolts = s.bolts.filter(b => b.life > 0);
        s.flash = Math.max(0, s.flash - dt * 2.5);

        // Neige
        if (s.flakes.length) {
            const drift = s.cfg.wind * 7, damp = Math.pow(0.04, dt);
            if (ptr.in) push(s.flakes, ptr.x, ptr.y, 120, 900 * dt);
            const cols = s.snowH.length, cap = H * 0.065;
            for (const f of s.flakes) {
                f.vx *= damp;
                f.vy *= damp;
                f.x += (Math.sin(s.t * 1.1 + f.ph) * 16 * f.z + drift * f.z + f.vx) * dt;
                f.y += ((28 + 46 * f.z) + f.vy) * dt;
                const col = clamp((f.x / 8) | 0, 0, cols - 1);
                if (f.y >= H - s.snowH[col]) {
                    if (f.z > 0.55 && f.x >= 0 && f.x <= W) {
                        for (let j = -2; j <= 2; j++) {
                            const i = col + j;
                            if (i >= 0 && i < cols) s.snowH[i] = Math.min(cap, s.snowH[i] + 0.45 * f.z * (1 - Math.abs(j) * 0.3));
                        }
                    }
                    Object.assign(f, newFlake(false));
                }
                if (f.x > W * 1.15) f.x = -W * 0.1;
                if (f.x < -W * 0.15) f.x = W * 1.05;
            }
        }

        // Vent
        if (s.leaves.length) {
            const damp = Math.pow(0.08, dt);
            if (ptr.in) push(s.leaves, ptr.x, ptr.y, 110, 1500 * dt);
            for (const l of s.leaves) {
                l.vx *= damp;
                l.vy *= damp;
                l.x += ((180 + s.cfg.wind * 14) * l.sp + l.vx) * dt;
                l.y += (Math.sin(s.t * 2 + l.ph) * 60 + 18 + l.vy) * dt;
                l.rot += l.vr * dt;
                if (l.x > W + 40 || l.y > H + 40 || l.y < -60) Object.assign(l, newLeaf(false));
            }
        }
        for (const st of s.streaks) {
            st.x += st.sp * dt;
            if (st.x > W + 20) Object.assign(st, newStreak(false));
        }

        // Ciel dégagé : oiseaux le jour, étoiles filantes la nuit
        if (k === 'clear' && !s.cfg.night) {
            s.nextFlock -= dt;
            if (s.nextFlock <= 0) {
                flock(s, -40, H * rand(0.12, 0.4), false);
                s.nextFlock = rand(10, 18);
            }
        }
        for (const b of s.birds) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.burst) b.vy *= Math.pow(0.5, dt);
        }
        s.birds = s.birds.filter(b => b.x > -90 && b.x < W + 90 && b.y > -90);

        if (s.cfg.night && (k === 'clear' || k === 'wind')) {
            s.nextShoot -= dt;
            if (s.nextShoot <= 0 && !s.shoot) {
                shoot(s, rand(0.4, 1) * W, rand(0.02, 0.3) * H);
                s.nextShoot = rand(6, 14);
            }
        }
        if (s.shoot) {
            s.shoot.x += s.shoot.vx * dt;
            s.shoot.y += s.shoot.vy * dt;
            s.shoot.life -= dt;
            if (s.shoot.life <= 0) s.shoot = null;
        }

        // Brouillard : les bandes dérivent, la trace du curseur se referme
        if (s.fog) {
            const F = s.fog;
            for (const b of F.bands) {
                b.x += b.sp * dt;
                if (b.x > F.fw + b.w / 2) b.x = -b.w / 2;
                if (b.x < -b.w / 2) b.x = F.fw + b.w / 2;
            }
            F.wctx.globalCompositeOperation = 'destination-out';
            F.wctx.fillStyle = `rgba(0,0,0,${Math.min(1, 0.4 * dt)})`;
            F.wctx.fillRect(0, 0, F.fw, F.fh);
            F.wctx.globalCompositeOperation = 'source-over';
        }

        const sunTarget = ptr.in && sunVisible(s) && Math.hypot(ptr.x - sunX(), ptr.y - sunY()) < sunR() * 1.9 ? 1 : 0;
        s.sunHover += (sunTarget - s.sunHover) * Math.min(1, dt * 6);
    }

    /* ---------- Dessin ---------- */
    const sunR = () => clamp(Math.min(W, H) * 0.075, 30, 78);
    const sunX = () => W * 0.78 - (ptr.px - 0.5) * 16;
    const sunY = () => H * 0.2 - (ptr.py - 0.5) * 10;
    function sunVisible(s) {
        const k = s.cfg.kind;
        return k === 'clear' || k === 'wind' || k === 'fog' || (k === 'clouds' && s.cfg.cover < 0.85);
    }

    function drawSky(s) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, s.pal[0]);
        g.addColorStop(1, s.pal[1]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    function drawStars(s) {
        if (!s.stars.length) return;
        ctx.fillStyle = '#ffffff';
        for (const st of s.stars) {
            ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.t * st.sp + st.ph));
            ctx.fillRect(st.x, st.y, st.r, st.r);
        }
        ctx.globalAlpha = 1;
        if (s.shoot) {
            const sh = s.shoot, a = clamp(sh.life / 0.9, 0, 1);
            ctx.strokeStyle = '#ffffff';
            ctx.lineCap = 'round';
            for (let i = 0; i < 4; i++) {
                ctx.globalAlpha = a * (1 - i / 4);
                ctx.lineWidth = 1.8 - i * 0.35;
                ctx.beginPath();
                ctx.moveTo(sh.x - sh.vx * 0.03 * i, sh.y - sh.vy * 0.03 * i);
                ctx.lineTo(sh.x - sh.vx * 0.03 * (i + 1), sh.y - sh.vy * 0.03 * (i + 1));
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
    }

    function drawSunMoon(s) {
        const k = s.cfg.kind;
        const x = sunX(), y = sunY(), r = sunR();
        if (s.cfg.night) {
            if (!['clear', 'clouds', 'wind', 'fog'].includes(k)) return;
            const mr = r * 0.8;
            ctx.globalAlpha = k === 'fog' ? 0.45 : 1;
            ctx.fillStyle = MOON;
            ctx.beginPath();
            ctx.arc(x, y, mr, 0, TAU);
            ctx.fill();
            ctx.fillStyle = 'rgba(60,50,30,0.09)';
            for (const [cx, cy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.09]]) {
                ctx.beginPath();
                ctx.arc(x + cx * mr, y + cy * mr, cr * mr, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            return;
        }
        if (!sunVisible(s)) return;
        const pale = k === 'fog';
        ctx.globalAlpha = pale ? 0.3 : 1;
        if (!pale) {
            const a0 = s.t * 0.08, inner = r * 1.3, outer = r * (1.6 + 0.35 * s.sunHover);
            ctx.strokeStyle = SUN;
            ctx.lineWidth = r * 0.1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                const a = a0 + i * TAU / 12;
                ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
                ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = pale ? '#ffffff' : SUN;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawBolts(s) {
        if (!s.bolts.length) return;
        ctx.strokeStyle = '#f5f8ff';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const b of s.bolts) {
            ctx.globalAlpha = b.life > 0.38 ? 1 : (Math.sin(s.t * 90) > 0 ? 0.9 : 0.25) * (b.life / 0.38);
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            b.main.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
            ctx.lineWidth = 1.2;
            for (const br of b.branches) {
                ctx.beginPath();
                br.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawClouds(s) {
        const k = s.cfg.kind;
        for (const c of s.clouds) {
            ctx.globalAlpha = k === 'fog' ? 0.7 : 1;
            ctx.drawImage(c.img, c.x - (ptr.px - 0.5) * 36 * c.depth, c.y - (ptr.py - 0.5) * 10 * c.depth, c.w, c.h);
        }
        ctx.globalAlpha = 1;
    }

    function drawBirds(s) {
        if (!s.birds.length) return;
        ctx.strokeStyle = '#24323f';
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const b of s.birds) {
            const flap = Math.sin(s.t * 9 + b.ph) * b.size * 0.55;
            ctx.moveTo(b.x - b.size, b.y - flap);
            ctx.quadraticCurveTo(b.x - b.size * 0.4, b.y - b.size * 0.2, b.x, b.y);
            ctx.quadraticCurveTo(b.x + b.size * 0.4, b.y - b.size * 0.2, b.x + b.size, b.y - flap);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function drawHill(seed, base, amps, freqs, color, off) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-30, H);
        for (let x = -30; x <= W + 30; x += 12) ctx.lineTo(x, hillY(seed, x - off, base, amps, freqs));
        ctx.lineTo(W + 30, H);
        ctx.closePath();
        ctx.fill();
    }

    function drawHills(s) {
        drawHill(s.hills[0], 0.75, [0.025, 0.015, 0.008], [0.7, 1.9, 4.3], s.pal[2], (ptr.px - 0.5) * 10);
        drawHill(s.hills[1], 0.86, [0.03, 0.012, 0.006], [0.5, 1.4, 3.7], s.pal[3], (ptr.px - 0.5) * 22);
    }

    function drawFog(s) {
        const F = s.fog;
        if (!F) return;
        const g = F.lctx;
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, F.fw, F.fh);
        g.globalAlpha = 0.32 * F.intensity;
        g.fillStyle = s.pal[7];
        g.fillRect(0, 0, F.fw, F.fh);
        for (const b of F.bands) {
            g.globalAlpha = b.a * F.intensity;
            g.drawImage(F.sprite, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'destination-out';
        g.drawImage(F.wipe, 0, 0);
        g.globalCompositeOperation = 'source-over';
        ctx.drawImage(F.layer, 0, 0, W, H);
    }

    function drawRain(s) {
        if (!s.drops.length) return;
        const vx0 = windPx(s);
        ctx.strokeStyle = s.pal[6];
        ctx.lineCap = 'round';
        const buckets = [[0, 0.55, 0.22, 1], [0.55, 0.8, 0.38, 1.2], [0.8, 1.01, 0.58, 1.6]];
        for (const [lo, hi, a, lw] of buckets) {
            ctx.globalAlpha = s.cfg.kind === 'drizzle' ? a * 0.8 : a;
            ctx.lineWidth = s.cfg.kind === 'drizzle' ? lw * 0.8 : lw;
            ctx.beginPath();
            for (const d of s.drops) {
                if (d.z < lo || d.z >= hi) continue;
                const k = d.len / d.vy;
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x - vx0 * d.z * k, d.y - d.len);
            }
            ctx.stroke();
        }
        ctx.lineWidth = 1;
        for (const p of s.splashes) {
            ctx.globalAlpha = p.life * 0.55;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.r, p.r * 0.35, 0, 0, TAU);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawSnow(s) {
        if (!s.flakes.length) return;
        ctx.fillStyle = s.pal[6];
        for (const [lo, hi, a] of [[0, 0.55, 0.5], [0.55, 0.8, 0.75], [0.8, 1.01, 0.95]]) {
            ctx.globalAlpha = a;
            ctx.beginPath();
            for (const f of s.flakes) {
                if (f.z < lo || f.z >= hi) continue;
                ctx.moveTo(f.x + f.r, f.y);
                ctx.arc(f.x, f.y, f.r, 0, TAU);
            }
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Couche au sol
        const h = s.snowH;
        ctx.fillStyle = s.cfg.night ? '#c9d2e0' : '#f6f8fb';
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, H - h[0]);
        for (let i = 1; i < h.length - 1; i++) {
            const x = i * 8, xn = (i + 1) * 8;
            ctx.quadraticCurveTo(x, H - h[i], (x + xn) / 2, H - (h[i] + h[i + 1]) / 2);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
    }

    function drawWind(s) {
        if (s.streaks.length) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            for (const st of s.streaks) {
                ctx.globalAlpha = st.a;
                ctx.beginPath();
                ctx.moveTo(st.x, st.y);
                ctx.quadraticCurveTo(st.x + st.len / 2, st.y - 7, st.x + st.len, st.y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        for (const l of s.leaves) {
            ctx.save();
            ctx.translate(l.x, l.y);
            ctx.rotate(l.rot);
            ctx.fillStyle = l.col;
            ctx.beginPath();
            ctx.ellipse(0, 0, l.s, l.s * 0.45, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function draw(s, dt) {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        drawSky(s);
        drawStars(s);
        drawSunMoon(s);
        drawBolts(s);
        drawClouds(s);
        drawBirds(s);
        drawHills(s);
        drawFog(s);
        drawRain(s);
        drawSnow(s);
        drawWind(s);
        if (s.flash > 0) {
            ctx.globalAlpha = s.flash * 0.55;
            ctx.fillStyle = '#dfe8f5';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
        }
        if (fade > 0 && fadeC) {
            ctx.globalAlpha = fade;
            ctx.drawImage(fadeC, 0, 0, W, H);
            ctx.globalAlpha = 1;
            fade = Math.max(0, fade - dt * 1.6);
        }
    }

    /* ---------- Boucle ---------- */
    function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
        lastT = now;
        ptr.px += (ptr.nx - ptr.px) * Math.min(1, dt * 3);
        ptr.py += (ptr.ny - ptr.py) * Math.min(1, dt * 3);
        if (S) {
            update(S, dt);
            draw(S, dt);
        }
    }

    function drawStatic() {
        if (S && ctx) {
            fade = 0;
            draw(S, 0);
        }
    }

    function run() {
        if (reduceMQ.matches || raf || !cv || document.hidden) return;
        lastT = 0;
        raf = requestAnimationFrame(frame);
    }

    function halt() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
    }

    /* ---------- Événements ---------- */
    function local(e) {
        const r = cv.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    }

    function onMove(e) {
        if (!cv) return;
        const [x, y] = local(e);
        ptr.x = x;
        ptr.y = y;
        ptr.in = y >= 0 && y < H;
        ptr.nx = clamp(x / W, 0, 1);
        ptr.ny = clamp(y / H, 0, 1);
        if (S && S.fog && ptr.in) {
            const F = S.fog, sx = F.fw / W, br = 34;
            const x0 = ptr.lx == null ? x : ptr.lx, y0 = ptr.ly == null ? y : ptr.ly;
            const steps = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 20));
            F.wctx.globalAlpha = 0.5;
            for (let i = 1; i <= steps; i++) {
                const px = (x0 + (x - x0) * i / steps) * sx, py = (y0 + (y - y0) * i / steps) * sx;
                F.wctx.drawImage(F.brush, px - br, py - br, br * 2, br * 2);
            }
            F.wctx.globalAlpha = 1;
        }
        ptr.lx = x;
        ptr.ly = y;
    }

    function onLeave() {
        ptr.in = false;
        ptr.nx = 0.5;
        ptr.ny = 0.5;
        ptr.lx = ptr.ly = null;
    }

    function onDown(e) {
        if (!S || !cv) return;
        if (e.target.closest && e.target.closest('.meteo-panel, .overlay-footer, .side-arrow, button, a, [role="button"]')) return;
        const [x, y] = local(e);
        if (y < 0 || y > H) return;
        const k = S.cfg.kind;
        if (k === 'storm') strike(S, x, Math.max(y, H * 0.3));
        else if (k === 'clear' && !S.cfg.night) flock(S, x, y, true);
        else if (S.cfg.night && (k === 'clear' || k === 'wind')) shoot(S, x, y);
        else if (k === 'rain' || k === 'drizzle') for (let i = 0; i < 6; i++) splash(S, x + rand(-14, 14), y + rand(-4, 4), 1);
        else if (k === 'snow') push(S.flakes, x, y, 220, 520);
        else if (k === 'wind') push(S.leaves, x, y, 260, 900);
        else if (k === 'fog') {
            const F = S.fog, sx = F.fw / W;
            F.wctx.globalAlpha = 0.9;
            F.wctx.drawImage(F.brush, x * sx - 80, y * sx - 80, 160, 160);
            F.wctx.globalAlpha = 1;
        }
        if (reduceMQ.matches) drawStatic();
    }

    function resize() {
        if (!cv || !host) return;
        const footer = host.querySelector('.overlay-footer');
        const fh = footer ? footer.offsetHeight : 0;
        W = window.innerWidth;
        H = Math.max(200, window.innerHeight - fh);
        DPR = Math.min(window.devicePixelRatio || 1, 1.5);
        cv.width = Math.round(W * DPR);
        cv.height = Math.round(H * DPR);
        cv.style.width = W + 'px';
        cv.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        if (S) S = build(S.cfg);
        fade = 0;
        if (reduceMQ.matches) drawStatic();
    }

    let resizeTimer = 0;
    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 120);
    }

    function onVis() {
        if (document.hidden) halt();
        else run();
    }

    function onMotionPref() {
        if (reduceMQ.matches) { halt(); drawStatic(); } else run();
    }

    /* ---------- API ---------- */
    function setScene(cfg) {
        if (!cv || !cfg) return;
        if (S && sameCfg(S.cfg, cfg)) return;
        if (S && !reduceMQ.matches) {
            fadeC = fadeC || document.createElement('canvas');
            fadeC.width = cv.width;
            fadeC.height = cv.height;
            fadeC.getContext('2d').drawImage(cv, 0, 0);
            fade = 1;
        }
        S = build(cfg);
        if (reduceMQ.matches) drawStatic();
    }

    function start(overlayEl, cfg) {
        if (host && host !== overlayEl) stop();
        if (!cv) {
            host = overlayEl;
            cv = document.createElement('canvas');
            cv.className = 'meteo-scene';
            cv.setAttribute('aria-hidden', 'true');
            host.insertBefore(cv, host.firstChild);
            ctx = cv.getContext('2d');
            host.classList.add('meteo-on');
            host.addEventListener('pointermove', onMove);
            host.addEventListener('pointerdown', onDown);
            host.addEventListener('pointerleave', onLeave);
            window.addEventListener('resize', onResize);
            document.addEventListener('visibilitychange', onVis);
            if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onMotionPref);
            resize();
        }
        setScene(cfg);
        run();
    }

    function stop() {
        halt();
        clearTimeout(resizeTimer);
        if (host) {
            host.classList.remove('meteo-on');
            host.removeEventListener('pointermove', onMove);
            host.removeEventListener('pointerdown', onDown);
            host.removeEventListener('pointerleave', onLeave);
        }
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVis);
        if (reduceMQ.removeEventListener) reduceMQ.removeEventListener('change', onMotionPref);
        if (cv) cv.remove();
        cv = ctx = null;
        host = null;
        S = null;
        fade = 0;
        onLeave();
    }

    window.MeteoScene = {
        start, stop, set: setScene, fromWeather, preset, kindFromId, isLight,
        isActive: () => !!cv,
        current: () => (S ? S.cfg : null)
    };
})();
