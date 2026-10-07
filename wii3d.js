/* =========================================
   WII 3D — cadres de chaînes en Three.js
   Calque WebGL transparent posé au-dessus de la grille DOM.
   Le contenu des chaînes reste en HTML ; Three.js dessine
   le cadre plastique brillant, le reflet vitré, le halo bleu
   au survol et l'inclinaison 3D qui suit la souris.
   Si WebGL n'est pas dispo, le site reste en mode CSS d'origine.
   ========================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FOV = 30;
const RADIUS = 20;       // = border-radius CSS des .channel
const FRAME = 6;         // épaisseur visible du cadre (px)
const DEPTH = 5;         // profondeur d'extrusion (px)
const MAX_TILT = 0.10;   // rad (~6°)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
    console.warn('[wii3d] WebGL indisponible, fallback CSS', e);
}

if (renderer) init();

function init() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.id = 'wii3d-canvas';
    document.body.appendChild(canvas);
    document.body.classList.add('wii3d-on');

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 20000);
    let camDist = 1000;

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(-0.4, 1, 1.2);
    scene.add(key, new THREE.AmbientLight(0xffffff, 0.5));

    /* ---------- Matériaux ---------- */
    const frameMat = new THREE.MeshPhysicalMaterial({
        color: 0xf4f5f7, roughness: 0.28, metalness: 0.0,
        clearcoat: 1, clearcoatRoughness: 0.08,
        emissive: 0x4ac0e0, emissiveIntensity: 0,
    });

    // Vitre : dégradé brillant en haut + balayage lumineux au survol,
    // masqué par un rectangle arrondi (SDF) pour coller au cadre.
    const glassVert = /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
    const glassFrag = /* glsl */`
        uniform vec2 uSize; uniform float uRadius; uniform float uHover;
        uniform float uSweep; uniform float uDark; uniform float uEmpty; uniform float uOp;
        varying vec2 vUv;
        float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
        void main(){
            vec2 p = (vUv - 0.5) * uSize;
            float d = sdRound(p, uSize*0.5, uRadius);
            float mask = 1.0 - smoothstep(-1.0, 0.5, d);
            // reflet haut : bande douce sur ~45% de la hauteur
            float top = smoothstep(0.52, 1.0, vUv.y) * 0.22 * (1.0 - uDark*0.55);
            // liseré intérieur clair
            float rim = (1.0 - smoothstep(0.0, 6.0, -d)) * 0.18;
            // balayage diagonal au survol
            float diag = (vUv.x + vUv.y) * 0.5;
            float sweep = exp(-pow((diag - uSweep) * 9.0, 2.0)) * 0.35 * uHover;
            // léger voile bleu au survol
            vec3 col = vec3(1.0);
            float a = top + rim + sweep;
            col = mix(col, vec3(0.29,0.75,0.88), uHover * 0.35);
            a += uHover * 0.04;
            a *= (1.0 - uEmpty * 0.6);
            gl_FragColor = vec4(col, a * mask * uOp);
        }`;

    // Halo bleu extérieur (additif)
    const glowFrag = /* glsl */`
        uniform vec2 uSize; uniform float uRadius; uniform float uHover; uniform float uPad;
        varying vec2 vUv;
        float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
        void main(){
            vec2 full = uSize + uPad*2.0;
            vec2 p = (vUv - 0.5) * full;
            float d = sdRound(p, uSize*0.5, uRadius);
            float g = exp(-max(d,0.0) / 9.0) * step(-2.0, d);
            gl_FragColor = vec4(vec3(0.29,0.75,0.88), clamp(g * uHover * 0.85, 0.0, 1.0));
        }`;

    /* ---------- Géométries (cache par taille) ---------- */
    const geoCache = new Map();
    function roundedRectShape(w, h, r) {
        const s = new THREE.Shape();
        const x = -w / 2, y = -h / 2;
        s.moveTo(x + r, y);
        s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
        s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
        s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
        return s;
    }
    function frameGeo(w, h) {
        const k = `${Math.round(w)}x${Math.round(h)}`;
        if (geoCache.has(k)) return geoCache.get(k);
        const bevel = 2;
        const outer = roundedRectShape(w - bevel * 2, h - bevel * 2, RADIUS - bevel);
        const hw = w - FRAME * 2, hh = h - FRAME * 2;
        const hole = roundedRectShape(hw + bevel * 2, hh + bevel * 2, Math.max(RADIUS - FRAME + bevel, 2));
        outer.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(outer, {
            depth: DEPTH, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
            bevelSegments: 4, curveSegments: 10,
        });
        g.translate(0, 0, -DEPTH / 2);
        geoCache.set(k, g);
        return g;
    }

    /* ---------- Tuiles ---------- */
    const tiles = new Map(); // element -> tile
    const pool = [];

    function makeTile() {
        const group = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BufferGeometry(), frameMat.clone());
        const glassMat = new THREE.ShaderMaterial({
            vertexShader: glassVert, fragmentShader: glassFrag, transparent: true, depthWrite: false,
            uniforms: { uSize: { value: new THREE.Vector2() }, uRadius: { value: RADIUS - FRAME },
                        uHover: { value: 0 }, uSweep: { value: -1 }, uDark: { value: 0 }, uEmpty: { value: 0 }, uOp: { value: 1 } },
        });
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glassMat);
        glass.position.z = DEPTH / 2 + 0.5;
        const glowMat = new THREE.ShaderMaterial({
            vertexShader: glassVert, fragmentShader: glowFrag, transparent: true, depthWrite: false,
            uniforms: { uSize: { value: new THREE.Vector2() }, uRadius: { value: RADIUS }, uHover: { value: 0 }, uPad: { value: 28 } },
        });
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
        glow.position.z = -DEPTH;
        glow.renderOrder = -1;
        group.add(glow, frame, glass);
        scene.add(group);
        return { group, frame, glass, glow, w: 0, h: 0, hover: 0, tx: 0, ty: 0, rx: 0, ry: 0, sweep: -1, lift: 0 };
    }

    function syncTiles() {
        const els = document.querySelectorAll('#grid-track .channel');
        const seen = new Set();
        els.forEach(el => {
            seen.add(el);
            if (!tiles.has(el)) tiles.set(el, pool.pop() || makeTile());
        });
        for (const [el, t] of tiles) {
            if (!seen.has(el)) { t.group.visible = false; pool.push(t); tiles.delete(el); }
        }
    }

    /* ---------- Survol / inclinaison ---------- */
    let hovered = null;
    const mouse = { x: 0, y: 0 };
    const track = document.getElementById('grid-track');
    new MutationObserver(syncTiles).observe(track, { childList: true, subtree: true });
    syncTiles();

    window.addEventListener('pointermove', e => {
        mouse.x = e.clientX; mouse.y = e.clientY;
        const el = e.target.closest?.('#grid-track .channel:not(.empty)') || null;
        if (el !== hovered) {
            hovered = el;
            const t = el && tiles.get(el);
            if (t) t.sweep = -0.3; // relance le balayage
        }
    });
    document.addEventListener('pointerleave', () => { hovered = null; });

    /* ---------- Resize ---------- */
    function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camDist = (h / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        camera.position.set(0, 0, camDist);
        camera.near = camDist / 10; camera.far = camDist * 3;
        camera.updateProjectionMatrix();
        document.documentElement.style.setProperty('--wii3d-persp', camDist + 'px');
    }
    window.addEventListener('resize', resize);
    resize();

    /* ---------- Boucle ---------- */
    const clock = new THREE.Clock();
    const opacityCache = new Map();
    let darkPrev = null;

    function frameLoop() {
        const dt = Math.min(clock.getDelta(), 0.05);
        const k = 1 - Math.pow(0.0005, dt); // lissage
        const vw = window.innerWidth, vh = window.innerHeight;
        const dark = document.body.classList.contains('dark-mode');
        const gridShown = document.getElementById('grid-wrapper')?.classList.contains('grid-visible');
        canvas.style.opacity = gridShown ? '1' : '0';

        if (dark !== darkPrev) {
            darkPrev = dark;
            for (const t of [...tiles.values(), ...pool]) {
                t.frame.material.color.set(dark ? 0x2a2f45 : 0xf4f5f7);
                t.frame.material.roughness = dark ? 0.35 : 0.28;
                t.frame.material.envMapIntensity = dark ? 0.25 : 1;
                t.glass.material.uniforms.uDark.value = dark ? 1 : 0;
            }
            frameMat.color.set(dark ? 0x2a2f45 : 0xf4f5f7);
        }

        opacityCache.clear();
        for (const [el, t] of tiles) {
            const r = el.getBoundingClientRect();
            const page = el.parentElement;
            let pageOp = opacityCache.get(page);
            if (pageOp === undefined) { pageOp = parseFloat(getComputedStyle(page).opacity); opacityCache.set(page, pageOp); }
            const hidden = el.classList.contains('hidden');
            const offscreen = r.right < -50 || r.left > vw + 50 || r.width < 2;
            t.group.visible = !hidden && !offscreen && pageOp > 0.02;
            if (!t.group.visible) continue;

            // taille de base (sans le scale CSS appliqué par nous)
            const baseW = el.offsetWidth, baseH = el.offsetHeight;
            if (baseW !== t.w || baseH !== t.h) {
                t.w = baseW; t.h = baseH;
                t.frame.geometry = frameGeo(baseW, baseH);
                t.glass.scale.set(baseW - FRAME * 2 + 2, baseH - FRAME * 2 + 2, 1);
                t.glass.material.uniforms.uSize.value.set(baseW - FRAME * 2 + 2, baseH - FRAME * 2 + 2);
                const pad = t.glow.material.uniforms.uPad.value;
                t.glow.scale.set(baseW + pad * 2, baseH + pad * 2, 1);
                t.glow.material.uniforms.uSize.value.set(baseW, baseH);
            }
            const isEmpty = el.classList.contains('empty');
            t.glass.material.uniforms.uEmpty.value = isEmpty ? 1 : 0;

            // cible hover / tilt
            const isHover = el === hovered && !reduceMotion;
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            let tRx = 0, tRy = 0;
            if (isHover) {
                const nx = THREE.MathUtils.clamp((mouse.x - cx) / (r.width / 2), -1, 1);
                const ny = THREE.MathUtils.clamp((mouse.y - cy) / (r.height / 2), -1, 1);
                tRy = nx * MAX_TILT; tRx = ny * MAX_TILT;
            }
            t.hover += ((el === hovered ? 1 : 0) - t.hover) * k;
            t.rx += (tRx - t.rx) * k;
            t.ry += (tRy - t.ry) * k;
            t.lift += ((isHover ? 1 : 0) - t.lift) * k;
            if (t.sweep < 1.4 && el === hovered) t.sweep += dt * 1.6;

            const scale = 1 + t.lift * 0.045;
            // pilote aussi le DOM pour que contenu et cadre bougent ensemble
            const tf = (t.lift > 0.002 || Math.abs(t.rx) > 0.0005 || Math.abs(t.ry) > 0.0005)
                ? `perspective(var(--wii3d-persp)) rotateX(${(-t.rx).toFixed(4)}rad) rotateY(${t.ry.toFixed(4)}rad) scale(${scale.toFixed(4)})`
                : '';
            if (el._wiiTf !== tf) { el.style.transform = tf; el._wiiTf = tf; }
            el.style.zIndex = t.lift > 0.01 ? '10' : '';

            // position (centre de la boîte non transformée)
            const ux = cx - vw / 2, uy = vh / 2 - cy;
            const pageScale = r.width / scale / baseW; // scale de la page inactive
            t.group.position.set(ux, uy, 0);
            t.group.rotation.set(-t.rx, t.ry, 0);
            t.group.scale.setScalar(scale * pageScale);
            t.group.position.z = t.lift * 2;

            const op = pageOp;
            t.frame.material.transparent = op < 0.999;
            t.frame.material.opacity = op;
            t.frame.material.emissiveIntensity = t.hover * 0.9;
            t.glass.material.uniforms.uHover.value = t.hover;
            t.glass.material.uniforms.uSweep.value = t.sweep;
            t.glow.material.uniforms.uHover.value = t.hover * op;
            t.glass.material.uniforms.uOp.value = op;
        }
        renderer.render(scene, camera);
        requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);
}
