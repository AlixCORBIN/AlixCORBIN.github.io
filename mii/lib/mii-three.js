/* =========================================================
   MII THREE : construit un Mii 3D à partir des données.
   THREE est injecté (createMiiKit(THREE)) pour que les jeux
   bundlés (Casino, Vite) utilisent leur propre instance.

   Repère : pieds en y=0, regard vers +z. Hauteur ~1.6 à 2.0.
   ========================================================= */
import { FACE_TEX, drawFace, layout, shade } from './mii-face.js';
import { FAV_COLORS, PANTS_COLORS } from './mii-core.js';

const PI = Math.PI;
const W = 0.75 * PI;              // largeur angulaire de la zone visage
const PHI0 = PI / 2 - W / 2;      // début (le +z est à phi = PI/2)
const T0 = 0.2 * PI;              // haut de la zone visage

/* Formes de visage : déformation de la sphère unité */
const SHAPES = [
    { jaw: .8, len: 1.06 },
    { jaw: .95, len: .97 },
    { jaw: 1, sq: .55, len: 1.02 },
    { jaw: .78, len: 1.2 },
    { jaw: .6, chin: .3, fore: -.06, len: 1.07 },
    { jaw: 1.1, fore: .14, len: 1.0 },
    { jaw: .55, chin: .5, len: 1.12 },
    { jaw: .72, cheek: .13, len: 1.05 },
];

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function deformUnit(x, y, z, shape) {
    const s = SHAPES[shape] || SHAPES[0];
    if (s.sq) {
        const w = clamp01((0.35 - y) / 0.8) * s.sq;
        const m = Math.max(Math.abs(x), Math.abs(y) * 1.05, Math.abs(z)) || 1;
        const k = 0.92 / m;
        x += (x * k - x) * w; y += (y * k - y) * w; z += (z * k - z) * w;
    }
    let wf;
    if (y >= 0) wf = 1 - (s.fore || 0) * y;
    else wf = 1 + ((s.jaw ?? 1) - 1) * Math.pow(-y, 1.6);
    if (s.cheek) wf += s.cheek * Math.exp(-(((y + 0.12) / 0.28) ** 2));
    if (s.chin && y < -0.3) wf *= 1 - s.chin * ((-y - 0.3) / 0.7);
    x *= wf;
    z *= 0.55 + 0.45 * wf;
    y *= s.len || 1;
    return [x * 1.02, y, z * 0.95];
}

export function createMiiKit(THREE) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    function fitToHead(geo, shape, r = 1) {
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const l = Math.hypot(x, y, z) || 1;
            const [a, b, c] = deformUnit(x / l, y / l, z / l, shape);
            p.setXYZ(i, a * l * r, b * l * r, c * l * r);
        }
        p.needsUpdate = true;
        geo.computeVertexNormals();
        return geo;
    }

    /* Point de la surface du visage correspondant à un pixel de la texture */
    function surfacePoint(px, py, shape, out = 0) {
        const phi = PHI0 + (px / FACE_TEX) * W, th = T0 + (py / FACE_TEX) * W;
        const sp = (ph, t) => deformUnit(-Math.cos(ph) * Math.sin(t), Math.cos(t), Math.sin(ph) * Math.sin(t), shape);
        const p = V(...sp(phi, th));
        if (out) {
            const a = V(...sp(phi + .01, th)).sub(p), b = V(...sp(phi, th + .01)).sub(p);
            const n = new THREE.Vector3().crossVectors(b, a).normalize();
            if (n.z < 0) n.negate();
            p.addScaledVector(n, out);
        }
        return p;
    }

    const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: 0, ...extra });

    /* ---------------- TÊTE ---------------- */
    function makeFaceTexture(m, blink) {
        const c = document.createElement('canvas');
        c.width = c.height = FACE_TEX;
        drawFace(c.getContext('2d'), m, { blink });
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
    }

    function buildHead(m) {
        const g = new THREE.Group();
        const shape = m.face.shape;
        const skin = mat(m.face.skin, { roughness: .7 });
        const head = new THREE.Mesh(fitToHead(new THREE.SphereGeometry(1, 64, 48), shape), skin);
        head.name = 'head';
        g.add(head);

        const faceTex = makeFaceTexture(m, false);
        const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
        const face = new THREE.Mesh(fitToHead(new THREE.SphereGeometry(1, 64, 48, PHI0, W, T0, W), shape, 1.004), faceMat);
        face.renderOrder = 1;
        g.add(face);

        // Oreilles
        for (const s of [-1, 1]) {
            const [x, y, z] = deformUnit(s, -.08, -.05, shape);
            const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin);
            ear.scale.set(.13, .24, .17);
            ear.position.set(x * .99, y, z);
            g.add(ear);
        }

        // Nez
        const nl = layout.nose(m);
        const nose = buildNose(m.nose.type, shade(m.face.skin, -.05));
        nose.position.copy(surfacePoint(256, nl.y, shape, -.02));
        nose.scale.setScalar(nl.s);
        g.add(nose);

        if (m.glasses.type) g.add(buildGlasses(m));
        if (m.beard.type === 6) g.add(buildLongBeard(m));

        const hair = buildHair(m);
        if (hair) g.add(hair);
        if (m.hat.type) g.add(buildHat(m));

        let blinkTex = null;
        g.userData.setBlink = (b) => {
            if (b && !blinkTex) blinkTex = makeFaceTexture(m, true);
            const want = b ? blinkTex : faceTex;
            if (faceMat.map !== want) { faceMat.map = want; faceMat.needsUpdate = true; }
        };
        return g;
    }

    /* ---------------- NEZ ---------------- */
    function buildNose(type, color) {
        const g = new THREE.Group();
        const m = mat(color, { roughness: .65 });
        const sph = (r, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) => {
            const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); g.add(o); return o;
        };
        const cone = (r, h, seg = 16) => { const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m); o.rotation.x = PI / 2; g.add(o); return o; };
        switch (type) {
            case 0: sph(.1, 1, .85, .9); break;
            case 1: sph(.1, 1.55, .8, .85); break;
            case 2: { const c = cone(.09, .26); c.position.z = .1; break; }
            case 3: { const c = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .2, 6, 12), m); c.rotation.x = PI / 2 + .45; c.position.set(0, -.02, .1); g.add(c); break; }
            case 4: sph(.165, 1, .9, .9); break;
            case 5: { const c = cone(.085, .3); c.rotation.x = PI / 2 + .55; c.position.set(0, .02, .1); sph(.06, 1, 1, 1, 0, -.06, .19); break; }
            case 6: { sph(.1, 1.1, .85, .9).rotation.x = -.3; sph(.025, 1, 1, 1, -.04, -.07, .07).material = mat('#5a3527'); sph(.025, 1, 1, 1, .04, -.07, .07).material = mat('#5a3527'); break; }
            case 7: sph(.06, 1, .8, .7); break;
            case 8: sph(.1, 2.1, .6, .65); break;
            case 9: { const c = cone(.1, .24, 3); c.rotation.z = PI; c.position.z = .09; break; }
            case 10: sph(.07, 1, 1.4, 1, 0, .1, .02); sph(.11, 1, .9, 1, 0, -.03, .06); break;
            case 11: { const c = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .3, 6, 12), m); c.rotation.x = -.25; c.position.set(0, .14, .02); g.add(c); sph(.085, 1, .9, 1, 0, -.02, .08); break; }
            default: sph(.1);
        }
        return g;
    }

    /* ---------------- LUNETTES ---------------- */
    function lensShape(type) {
        const s = new THREE.Shape();
        const rr = (w, h, r) => { s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h); };
        switch (type) {
            case 1: rr(.28, .17, .04); break;
            case 2: s.absarc(0, 0, .22, 0, PI * 2); break;
            case 3: s.absellipse(0, 0, .28, .18, 0, PI * 2); break;
            case 4: s.moveTo(-.28, .14); s.quadraticCurveTo(0, .22, .28, .14); s.quadraticCurveTo(.3, -.12, .05, -.24); s.quadraticCurveTo(-.3, -.22, -.28, .14); break;
            case 5: s.moveTo(-.28, .02); s.lineTo(.28, .02); s.quadraticCurveTo(.28, -.2, 0, -.2); s.quadraticCurveTo(-.28, -.2, -.28, .02); break;
            case 6: rr(.29, .2, .02); break;
            case 7: for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, r = i % 2 ? .12 : .27; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); break;
            case 8: s.moveTo(-.3, .16); s.lineTo(.3, .16); s.lineTo(.25, -.12); s.quadraticCurveTo(0, -.24, -.22, -.14); s.closePath(); break;
            case 9: s.moveTo(0, -.22); s.bezierCurveTo(-.15, -.1, -.32, .02, -.25, .14); s.bezierCurveTo(-.18, .25, -.03, .2, 0, .1); s.bezierCurveTo(.03, .2, .18, .25, .25, .14); s.bezierCurveTo(.32, .02, .15, -.1, 0, -.22); break;
            default: s.absarc(0, 0, .22, 0, PI * 2);
        }
        return s;
    }

    function buildGlasses(m) {
        const g = new THREE.Group();
        const shape = m.face.shape;
        const ey = layout.eye(m), gl = layout.glasses(m);
        const frameMat = mat(m.glasses.color, { roughness: .35, metalness: m.glasses.type === 4 ? .6 : .1 });
        const tinted = m.glasses.tint || m.glasses.type === 8;
        const lensMat = new THREE.MeshStandardMaterial({ color: tinted ? shade(m.glasses.color, -.6) : '#dff2ff', transparent: true, opacity: tinted ? .82 : .18, roughness: .1, depthWrite: false, side: THREE.DoubleSide });
        const sh = lensShape(m.glasses.type);
        const pts = sh.getSpacedPoints(64).map((p) => V(p.x, p.y, 0));
        const curve = new THREE.CatmullRomCurve3(pts, true);
        const tube = m.glasses.type === 6 ? .038 : .022;
        const k = gl.s;
        let maxZ = 0, halfX = 0;
        for (const side of [-1, 1]) {
            const c = surfacePoint(256 + side * ey.dx, gl.y, shape);
            maxZ = Math.max(maxZ, c.z); halfX = Math.abs(c.x);
            const lens = new THREE.Group();
            lens.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, tube, 8, true), frameMat));
            const glass = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), lensMat);
            glass.renderOrder = 2;
            lens.add(glass);
            lens.scale.set(side * k, k, k);
            lens.position.set(c.x, c.y, 0);
            lens.rotation.y = side * .22;
            lens.userData.side = side;
            g.add(lens);
        }
        g.children.forEach((l) => { l.position.z = maxZ + .1; });
        const yC = g.children[0].position.y;
        const bridge = new THREE.Mesh(new THREE.CylinderGeometry(tube, tube, Math.max(.02, halfX * 2 - .5 * k), 8), frameMat);
        bridge.rotation.z = PI / 2; bridge.position.set(0, yC + .07 * k, maxZ + .12);
        g.add(bridge);
        for (const s of [-1, 1]) {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(.025, .025, maxZ + .05), frameMat);
            arm.position.set(s * (halfX + .28 * k * .95), yC + .05, (maxZ + .1) / 2 - .05);
            g.add(arm);
        }
        return g;
    }

    function buildLongBeard(m) {
        const geo = new THREE.SphereGeometry(1, 24, 16, 0, PI * 2, PI * .45, PI * .55);
        const b = new THREE.Mesh(geo, mat(m.facialHairColor, { roughness: .9, side: THREE.DoubleSide }));
        b.scale.set(.5, .62, .36);
        b.position.set(0, -.48, .5);
        b.rotation.x = .3;
        return b;
    }

    /* ---------------- CHEVEUX ---------------- */
    const FRONT = PI / 2, BACK = 3 * PI / 2;

    function buildHair(m) {
        const st = m.hair.style;
        if (st === 11) return null;
        const shape = m.face.shape;
        const hm = mat(m.hair.color, { roughness: .78, side: THREE.DoubleSide });
        const g = new THREE.Group();
        const add = (geo, fit = true, r = 1) => { const o = new THREE.Mesh(fit ? fitToHead(geo, shape, r) : geo, hm); g.add(o); return o; };
        const seg = (r, phiC, phiW, t0, t1, wseg = 48) => add(new THREE.SphereGeometry(1, wseg, 24, phiC - phiW / 2, phiW, t0, t1 - t0), true, r);
        const cap = (r = 1.07, t1 = .36 * PI) => seg(r, FRONT, 2 * PI, 0, t1);
        const back = (r = 1.07, w = 1.12 * PI, t1 = .6 * PI, t0 = 0) => seg(r, BACK, w, t0, t1);
        const blob = (r, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) => {
            const o = add(new THREE.SphereGeometry(r, 28, 18), false);
            o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o;
        };
        const curtain = (h, w = 1.45 * PI, rTop = 1.0, rBot = 1.12, wave = 0) => {
            const geo = new THREE.CylinderGeometry(rTop, rBot, h, 48, 12, true, PI - w / 2, w);
            if (wave) {
                const p = geo.attributes.position;
                for (let i = 0; i < p.count; i++) {
                    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, z) || 1;
                    const d = 1 + wave * Math.sin((y + h / 2) * 9) * ((h / 2 - y) / h);
                    p.setXYZ(i, x / l * l * d, y, z / l * l * d);
                }
                geo.computeVertexNormals();
            }
            const o = add(geo, false);
            o.scale.set(1.02, 1, .95);
            o.position.y = -h / 2 + .05;
            return o;
        };
        const short = () => { cap(); back(); };
        const tube = (r, len, x, y, z, rx = 0, rz = 0) => {
            const o = add(new THREE.CapsuleGeometry(r, len, 6, 12), false); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); return o;
        };

        switch (st) {
            case 0: short(); break;
            case 1: cap(1.025, .4 * PI); back(1.025, 1.25 * PI, .6 * PI); break;
            case 2: back(1.08, 1.4 * PI, .55 * PI); seg(1.08, FRONT, .6 * PI, 0, .37 * PI); break;
            case 3: {
                cap(1.06, .34 * PI); back(1.06, 1.25 * PI, .58 * PI);
                for (let i = 0; i < 16; i++) {
                    const a = i * 2.39996, t = .08 * PI + (i / 16) * .3 * PI;
                    const dir = V(Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a) * .9).normalize();
                    const c = add(new THREE.ConeGeometry(.17, .5, 8), false);
                    c.position.copy(dir.clone().multiplyScalar(1.12));
                    c.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
                }
                break;
            }
            case 4: short(); blob(.5, 1.35, .45, .9, -.25, .8, .5, .3, 0, .35); break;
            case 5: cap(1.08); back(1.08, 1.45 * PI, .95 * PI); curtain(1.5); seg(1.085, FRONT, .5 * PI, 0, .3 * PI); break;
            case 6: short(); blob(.27, 1, 1, 1, 0, .35, -1.05); tube(.16, .9, 0, -.3, -1.3, .45); break;
            case 7: short(); for (const s of [-1, 1]) { blob(.2, 1, 1, 1, s * 1.0, .25, -.35); tube(.15, .75, s * 1.22, -.3, -.4, 0, s * .35); } break;
            case 8: cap(1.07, .4 * PI); back(1.07, 1.4 * PI, .58 * PI); blob(.42, 1, .9, 1, 0, .85, -.6); break;
            case 9: {
                const geo = new THREE.IcosahedronGeometry(1.25, 4);
                const p = geo.attributes.position;
                for (let i = 0; i < p.count; i++) {
                    const v = V(p.getX(i), p.getY(i), p.getZ(i));
                    v.multiplyScalar(1 + .05 * Math.sin(v.x * 9) * Math.sin(v.y * 9) * Math.sin(v.z * 9));
                    p.setXYZ(i, v.x, v.y, v.z);
                }
                geo.computeVertexNormals();
                const o = add(geo, false); o.position.set(0, .42, -.38); o.scale.set(1.05, .95, 1);
                break;
            }
            case 10: cap(1.015, .45 * PI).material = mat(shade(m.hair.color, .15), { roughness: .9 }); back(1.015, 1.2 * PI, .6 * PI).material = g.children[0].material; blob(1, .17, .5, 1.05, 0, .82, -.08); break;
            case 12: back(1.06, 1.5 * PI, .62 * PI, .3 * PI); break;
            case 13: {
                cap(1.05, .38 * PI); back(1.05, 1.3 * PI, .6 * PI);
                const N = 70;
                for (let i = 0; i < N; i++) {
                    const y = 1 - (i / N) * 1.1, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996;
                    const v = V(r * Math.cos(a), y, r * Math.sin(a));
                    if (v.z > .55 && v.y < .55) continue;
                    blob(.2, 1, 1, 1, v.x * 1.1, v.y * 1.08, v.z * 1.05);
                }
                break;
            }
            case 14: cap(1.09); back(1.09, 1.6 * PI, .72 * PI); curtain(.55, 1.6 * PI, 1.03, 1.12); seg(1.095, FRONT, .55 * PI, 0, .4 * PI); break;
            case 15: short(); blob(.55, 1.3, .7, 1.1, 0, .82, .45, -.4); break;
            case 16: cap(); back(1.07, 1.4 * PI, .7 * PI); blob(.5, 1.1, .9, .38, .32, .38, .86, .15, .3, -.45); break;
            case 17: cap(1.08); back(1.08, 1.5 * PI, .8 * PI); curtain(.75, 1.5 * PI, 1.0, 1.1); seg(1.085, FRONT, .45 * PI, 0, .32 * PI); break;
            case 18: cap(1.08); back(1.08, 1.45 * PI, .95 * PI); curtain(1.5); seg(1.09, FRONT, .7 * PI, 0, .42 * PI); for (const s of [-1, 1]) { const c = curtain(.6, .14 * PI, 1.0, 1.04); c.rotation.y = s * .55 * PI; } break;
            case 19: cap(1.02, .42 * PI).material = mat(shade(m.hair.color, .12), { roughness: .9 }); back(1.02, 1.2 * PI, .58 * PI).material = g.children[0].material; blob(.9, 1, .5, 1.1, 0, .72, .1, -.15); break;
            case 20: short(); for (let i = 0; i < 7; i++) blob(.16 - i * .008, 1, 1, 1, Math.sin(i * 1.4) * .04, .05 - i * .24, -1.05 - i * .05); break;
            case 21: {
                cap(1.06, .38 * PI); back(1.06, 1.3 * PI, .58 * PI);
                for (let i = 0; i < 24; i++) {
                    const a = PI - .78 * PI + (i / 23) * 1.56 * PI;
                    const x = Math.sin(a) * 1.02, z = Math.cos(a) * .98;
                    tube(.07, .9 + (i % 3) * .12, x, -.2, z, -z * .15, x * .15);
                }
                break;
            }
            case 22: cap(1.08); back(1.08, 1.45 * PI, .95 * PI); curtain(1.6, 1.45 * PI, 1.0, 1.25, .05); seg(1.085, FRONT, .5 * PI, 0, .3 * PI); break;
            case 23: cap(); back(1.07, 1.35 * PI, .66 * PI); for (const s of [-1, 1]) blob(.48, 1.1, .45, .7, s * .48, .72, .55, .4, 0, -s * .55); break;
            default: short();
        }
        if (m.hair.flip) g.scale.x = -1;
        return g;
    }

    /* ---------------- CHAPEAUX ---------------- */
    function buildHat(m) {
        const g = new THREE.Group();
        const c = m.hat.color;
        const hm = mat(c, { roughness: .6 });
        const dark = mat(shade(c, -.35));
        const add = (geo, material = hm) => { const o = new THREE.Mesh(geo, material); g.add(o); return o; };
        const big = m.hair.style === 9 ? 1.25 : 1;
        switch (m.hat.type) {
            case 1: {
                add(new THREE.SphereGeometry(1.12, 40, 20, 0, PI * 2, 0, .45 * PI));
                const brim = add(new THREE.CylinderGeometry(.75, .75, .05, 32, 1, false, -PI / 2, PI), dark);
                brim.scale.set(1, 1, .9); brim.position.set(0, .2, .85); brim.rotation.x = .12;
                add(new THREE.SphereGeometry(.08, 12, 8), dark).position.set(0, 1.12, 0);
                break;
            }
            case 2: {
                const top = add(new THREE.SphereGeometry(1.13, 40, 20, 0, PI * 2, 0, .5 * PI)); top.scale.set(1, 1.18, 1);
                const band = add(new THREE.TorusGeometry(1.1, .14, 12, 40), dark); band.rotation.x = PI / 2; band.position.y = .08;
                add(new THREE.SphereGeometry(.24, 16, 12), dark).position.set(0, 1.4, 0);
                break;
            }
            case 3: {
                const gold = mat('#e5b628', { metalness: .7, roughness: .3 });
                add(new THREE.CylinderGeometry(.75, .7, .32, 32, 1, true), gold).position.y = 1.05;
                for (let i = 0; i < 6; i++) {
                    const a = i * PI / 3;
                    const sp = add(new THREE.ConeGeometry(.12, .3, 8), gold); sp.position.set(Math.sin(a) * .72, 1.33, Math.cos(a) * .72);
                    add(new THREE.SphereGeometry(.07, 10, 8), mat(c, { roughness: .2 })).position.set(Math.sin(a) * .76, 1.06, Math.cos(a) * .76);
                }
                break;
            }
            case 4: {
                add(new THREE.CylinderGeometry(.82, .82, .05, 40), dark).position.y = .78;
                add(new THREE.CylinderGeometry(1.4, 1.4, .05, 40), mat('#1d1d1d')).position.y = .72;
                add(new THREE.CylinderGeometry(.8, .8, 1.05, 40), mat('#1d1d1d')).position.y = 1.3;
                add(new THREE.CylinderGeometry(.81, .81, .18, 40), hm).position.y = .88;
                break;
            }
            case 5: { const t = add(new THREE.TorusGeometry(1.06, .07, 10, 48)); t.rotation.x = PI / 2 - .35; t.position.set(0, .48, .05); break; }
            case 6: {
                add(new THREE.CylinderGeometry(1.55, 1.55, .05, 40), hm).position.y = .7;
                const cone = add(new THREE.ConeGeometry(.92, 1.9, 32)); cone.position.set(0, 1.6, -.1); cone.rotation.x = -.18;
                add(new THREE.CylinderGeometry(.9, .92, .18, 32), dark).position.y = .82;
                break;
            }
            case 7: {
                const arc = add(new THREE.TorusGeometry(1.15, .07, 10, 40, PI), dark); arc.rotation.z = 0; arc.position.y = .05;
                for (const s of [-1, 1]) { const cup = add(new THREE.CylinderGeometry(.3, .3, .2, 24)); cup.rotation.z = PI / 2; cup.position.set(s * 1.12, 0, 0); }
                break;
            }
            case 8: {
                for (const s of [-1, 1]) {
                    const ear = add(new THREE.ConeGeometry(.3, .7, 4)); ear.position.set(s * .55, 1.12, -.05); ear.rotation.z = -s * .35; ear.scale.z = .45;
                    const inner = add(new THREE.ConeGeometry(.17, .45, 4), mat('#f2a7b5')); inner.position.set(s * .55, 1.08, .06); inner.rotation.z = -s * .35; inner.scale.z = .3;
                }
                break;
            }
        }
        g.scale.setScalar(big);
        return g;
    }

    /* ---------------- CORPS ---------------- */
    function buildBody(m) {
        const g = new THREE.Group();
        const hk = .82 + .4 * m.body.height / 127, bk = .72 + .6 * m.body.build / 127;
        const shirt = mat(FAV_COLORS[m.favColor], { roughness: .75 });
        const pants = mat(PANTS_COLORS[m.body.pants], { roughness: .85 });
        const skin = mat(m.face.skin, { roughness: .7 });
        const shoes = mat('#2a2a2e', { roughness: .5 });
        const legH = .42 * hk, torsoH = .5 * hk;

        for (const s of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.085 * bk, legH, 6, 14), pants);
            leg.position.set(s * .1 * bk, legH / 2 + .07, 0); g.add(leg);
            const shoe = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 10), shoes);
            shoe.scale.set(1 * bk, .55, 1.5); shoe.position.set(s * .1 * bk, .05, .05); g.add(shoe);
        }
        const hip = new THREE.Mesh(new THREE.SphereGeometry(.2 * bk, 20, 12, 0, PI * 2, PI / 2, PI / 2), pants);
        hip.scale.set(1.02, .6, .8); hip.position.y = legH + .1; g.add(hip);

        const prof = [[.19, 0], [.215, .06], [.225, .25], [.215, .4], [.17, .47], [.06, .5], [0, .5]]
            .map(([r, y]) => new THREE.Vector2(r * bk, y * torsoH / .5));
        const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), shirt);
        torso.scale.z = .78; torso.position.y = legH + .1; g.add(torso);

        const shoulderY = legH + .1 + torsoH * .88;
        const arms = [];
        for (const s of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(s * .2 * bk, shoulderY, 0);
            const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.06 * Math.sqrt(bk), .3 * hk, 6, 12), shirt);
            arm.position.y = -.17 * hk; pivot.add(arm);
            const hand = new THREE.Mesh(new THREE.SphereGeometry(.065, 14, 10), skin);
            hand.position.y = -.37 * hk; pivot.add(hand);
            pivot.rotation.z = s * .18;
            g.add(pivot); arms.push(pivot);
        }
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .1, 12), skin);
        neck.position.y = legH + .1 + torsoH + .02; g.add(neck);
        g.userData.neckY = legH + .1 + torsoH + .05;
        g.userData.arms = arms;
        return g;
    }

    /* ---------------- MII COMPLET ---------------- */
    const HEAD_SCALE = .36;

    function buildMii(m, opts = {}) {
        const root = new THREE.Group();
        root.name = 'mii:' + (m.name || '');
        const head = buildHead(m);
        head.scale.setScalar(HEAD_SCALE);
        const headPivot = new THREE.Group();
        headPivot.add(head);
        head.position.y = HEAD_SCALE * 1.0;
        let body = null;
        if (opts.body !== false) {
            body = buildBody(m);
            root.add(body);
            headPivot.position.y = body.userData.neckY - .02;
        }
        root.add(headPivot);
        root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
        root.userData = {
            mii: m, head, headPivot, body,
            arms: body ? body.userData.arms : [],
            height: headPivot.position.y + HEAD_SCALE * 2.2,
            headCenterY: headPivot.position.y + HEAD_SCALE,
            blinkT: 2 + Math.random() * 3, t: Math.random() * 10,
        };
        return root;
    }

    /* Animation d'attente (respiration, clignement, léger mouvement de tête) */
    function tickMii(root, dt, state = {}) {
        const u = root.userData;
        u.t += dt;
        u.blinkT -= dt;
        if (state.eyesClosed) { u.head.userData.setBlink(true); u.blinkT = .5; }
        else if (u.blinkT < 0) { u.head.userData.setBlink(true); if (u.blinkT < -.12) { u.head.userData.setBlink(false); u.blinkT = 2 + Math.random() * 4; } }
        const walk = state.walk ? 1 : 0;
        u.headPivot.rotation.z = Math.sin(u.t * .9) * .03 * (1 - walk);
        u.headPivot.rotation.x = Math.sin(u.t * .6) * .02 + (state.lookDown || 0);
        if (state.lookYaw !== undefined) u.headPivot.rotation.y += (state.lookYaw - u.headPivot.rotation.y) * Math.min(1, dt * 4);
        if (u.body) {
            u.body.scale.y = 1 + Math.sin(u.t * 2.2) * .006;
            const sw = walk * Math.sin(u.t * 9) * .5;
            u.arms.forEach((a, i) => { a.rotation.x = (i ? -sw : sw); });
            root.position.y = walk * Math.abs(Math.sin(u.t * 9)) * .03;
        }
    }

    function disposeMii(root) {
        root.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
            ms.forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); });
        });
    }

    return { buildMii, buildHead, tickMii, disposeMii, HEAD_SCALE };
}
