import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    defaultMii, randomMii, sanitizeMii, cloneMii, isSelfAdmin, ADMIN_HATS, encodeMii, decodeMii, newId,
    COUNTS, RANGES, FAV_COLORS, SKIN_COLORS, HAIR_COLORS, EYE_COLORS, LIP_COLORS,
    GLASSES_COLORS, PANTS_COLORS, HAT_COLORS, GUEST_MIIS,
} from './lib/mii-core.js';
import { drawPartIcon } from './lib/mii-face.js';
import { createMiiKit } from './lib/mii-three.js';
import { miiStore, attachAccount } from './lib/mii-store.js';
import { getThumb, putThumb, thumbKey } from './lib/thumb-cache.js';
import { createAccount } from './lib/account.js';

const kit = createMiiKit(THREE);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') e.className = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else if (v !== false && v != null) e.setAttribute(k, v);
    }
    kids.flat().forEach((k) => k != null && e.append(k));
    return e;
};

/* =========================================================
   TEXTES FR / EN
   ========================================================= */
let lang = (() => { try { return localStorage.getItem('lang') || 'fr'; } catch { return 'fr'; } })();
const T = {
    fr: {
        back: '← Menu', empty: "Aucun Mii pour l'instant.", newMii: 'Créer un Mii', sortRecent: 'Récents', sortName: 'Nom', sortFav: 'Favoris',
        storageLocal: 'Enregistrés sur cet appareil', new: 'Nouveau', edit: 'Modifier', setMain: 'Mon Mii', fav: 'Favori', dup: 'Copier',
        share: 'Partager', import: 'Importer', delete: 'Effacer', cancel: 'Annuler', randomize: 'Au hasard', save: 'Enregistrer',
        count: (n) => `${n} Mii`,
        tabs: { profile: 'Profil', body: 'Corps', face: 'Visage', hair: 'Cheveux', brows: 'Sourcils', eyes: 'Yeux', nose: 'Nez', mouth: 'Bouche', beard: 'Pilosité', glasses: 'Lunettes', mole: 'Grain', hat: 'Chapeau' },
        name: 'Surnom', creator: 'Créateur', gender: 'Genre', male: 'Garçon', female: 'Fille', birthday: 'Anniversaire', day: 'Jour', month: 'Mois',
        favColor: 'Couleur préférée', favorite: 'Mii favori', height: 'Taille', build: 'Carrure', pants: 'Pantalon',
        shape: 'Forme du visage', skin: 'Teint', features: 'Traits & maquillage', hairStyle: 'Coiffure', hairColor: 'Couleur', flip: 'Raie inversée',
        type: 'Type', color: 'Couleur', size: 'Taille', rot: 'Rotation', spacing: 'Écart', vpos: 'Hauteur', hpos: 'Position',
        mustache: 'Moustache', beard: 'Barbe', facialHair: 'Couleur des poils', glassesType: 'Monture', tint: 'Verres teintés',
        moleOn: 'Grain de beauté', hatType: 'Chapeau', hatHint: 'Visible aussi dans les jeux.',
        newTitle: 'Nouveau Mii', newSub: 'Comment veux-tu commencer ?', fromScratch: 'De zéro', lookalike: 'Au hasard',
        pick: 'Choisis un visage', reroll: 'Autres visages', close: 'Fermer', fromGuest: 'Ou pars d’un Mii invité :',
        quitTitle: 'Quitter sans enregistrer ?', quitSub: 'Les modifications seront perdues.', quit: 'Quitter', keep: 'Continuer',
        delTitle: (n) => `Effacer ${n} ?`, delSub: 'Ce Mii sera supprimé de cet appareil.',
        shareTitle: 'Partager ce Mii', shareSub: 'Copie ce code et colle-le dans « Importer » sur un autre appareil.', copy: 'Copier le code', copied: 'Code copié',
        importTitle: 'Importer un Mii', importSub: 'Colle un code Mii (il commence par MII1.).', importBtn: 'Importer', badCode: 'Code invalide',
        saved: 'Mii enregistré', mainSet: (n) => `${n} est maintenant ton Mii`, full: 'Limite de 100 Mii atteinte', storageErr: "Impossible d'enregistrer sur cet appareil",
        months: ['—', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
        none: 'Aucun', copyOf: (n) => n.slice(0, 8) + ' 2',
        account: 'Compte', accTitle: 'Compte (facultatif)', accSub: 'Connecte-toi pour retrouver tes Mii sur tous tes appareils. Sans compte, tout reste enregistré sur cet appareil.',
        signIn: 'Connexion', signUp: 'Inscription', email: 'Adresse e-mail', password: 'Mot de passe', google: 'Continuer avec Google', or: 'ou',
        forgot: 'Mot de passe oublié ?', resetSent: 'E-mail de réinitialisation envoyé.', checkMail: 'Compte créé : clique sur le lien reçu par e-mail pour l’activer.',
        signOut: 'Se déconnecter', connected: 'Connecté', syncOk: 'Mii synchronisés avec ton compte', syncing: 'Synchronisation…', syncErr: 'Synchronisation impossible pour l’instant',
        syncBtn: 'Synchroniser', newPass: 'Nouveau mot de passe', setPass: 'Enregistrer le mot de passe', passSaved: 'Mot de passe modifié', welcome: (n) => `Connecté : ${n}`, bye: 'Déconnecté',
        offline: 'Comptes indisponibles (connexion au serveur impossible).', fill: 'Remplis l’e-mail et le mot de passe.',
        storageCloud: 'Synchronisés avec ton compte',
    },
    en: {
        back: '← Menu', empty: 'No Mii yet.', newMii: 'Create a Mii', sortRecent: 'Recent', sortName: 'Name', sortFav: 'Favorites',
        storageLocal: 'Saved on this device', new: 'New', edit: 'Edit', setMain: 'My Mii', fav: 'Favorite', dup: 'Copy',
        share: 'Share', import: 'Import', delete: 'Erase', cancel: 'Cancel', randomize: 'Random', save: 'Save',
        count: (n) => `${n} Mii`,
        tabs: { profile: 'Profile', body: 'Body', face: 'Face', hair: 'Hair', brows: 'Brows', eyes: 'Eyes', nose: 'Nose', mouth: 'Mouth', beard: 'Facial hair', glasses: 'Glasses', mole: 'Mole', hat: 'Hat' },
        name: 'Nickname', creator: 'Creator', gender: 'Gender', male: 'Male', female: 'Female', birthday: 'Birthday', day: 'Day', month: 'Month',
        favColor: 'Favorite color', favorite: 'Favorite Mii', height: 'Height', build: 'Build', pants: 'Pants',
        shape: 'Face shape', skin: 'Skin tone', features: 'Features & makeup', hairStyle: 'Hairstyle', hairColor: 'Color', flip: 'Flip parting',
        type: 'Type', color: 'Color', size: 'Size', rot: 'Rotation', spacing: 'Spacing', vpos: 'Height', hpos: 'Position',
        mustache: 'Mustache', beard: 'Beard', facialHair: 'Facial hair color', glassesType: 'Frames', tint: 'Tinted lenses',
        moleOn: 'Mole', hatType: 'Hat', hatHint: 'Also shown in the games.',
        newTitle: 'New Mii', newSub: 'How do you want to start?', fromScratch: 'From scratch', lookalike: 'Random',
        pick: 'Pick a face', reroll: 'More faces', close: 'Close', fromGuest: 'Or start from a guest Mii:',
        quitTitle: 'Quit without saving?', quitSub: 'Your changes will be lost.', quit: 'Quit', keep: 'Keep editing',
        delTitle: (n) => `Erase ${n}?`, delSub: 'This Mii will be removed from this device.',
        shareTitle: 'Share this Mii', shareSub: 'Copy this code and paste it in “Import” on another device.', copy: 'Copy code', copied: 'Code copied',
        importTitle: 'Import a Mii', importSub: 'Paste a Mii code (it starts with MII1.).', importBtn: 'Import', badCode: 'Invalid code',
        saved: 'Mii saved', mainSet: (n) => `${n} is now your Mii`, full: '100 Mii limit reached', storageErr: 'Could not save on this device',
        months: ['—', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        none: 'None', copyOf: (n) => n.slice(0, 8) + ' 2',
        account: 'Account', accTitle: 'Account (optional)', accSub: 'Sign in to get your Mii on all your devices. Without an account, everything stays on this device.',
        signIn: 'Sign in', signUp: 'Sign up', email: 'Email address', password: 'Password', google: 'Continue with Google', or: 'or',
        forgot: 'Forgot password?', resetSent: 'Reset email sent.', checkMail: 'Account created: click the link in your email to activate it.',
        signOut: 'Sign out', connected: 'Signed in', syncOk: 'Mii synced with your account', syncing: 'Syncing…', syncErr: 'Sync unavailable right now',
        syncBtn: 'Sync now', newPass: 'New password', setPass: 'Save password', passSaved: 'Password changed', welcome: (n) => `Signed in: ${n}`, bye: 'Signed out',
        offline: 'Accounts unavailable (cannot reach the server).', fill: 'Enter your email and password.',
        storageCloud: 'Synced with your account',
    },
};
const t = (k, ...a) => { const v = (T[lang] || T.fr)[k] ?? T.fr[k]; return typeof v === 'function' ? v(...a) : v; };

function applyStaticTexts() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    $('#btn-lang').textContent = lang === 'fr' ? 'EN' : 'FR';
    renderAccountState();
}

/* =========================================================
   SONS (ceux du menu du portfolio)
   ========================================================= */
const sfx = (() => {
    const mk = (src, vol) => { const a = new Audio(src); a.volume = vol; a.preload = 'auto'; return a; };
    const s = { pop: mk('../assets/wiiButtonPopUp.mp3', .25), click: mk('../assets/wiiClickChanel1.mp3', .35), back: mk('../assets/wiibackmenu.mp3', .35) };
    return (name) => { const a = s[name]; if (!a) return; try { a.currentTime = 0; a.play().catch(() => {}); } catch { /* ignore */ } };
})();

/* =========================================================
   ÉCLAIRAGE COMMUN
   ========================================================= */
function addLights(scene) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc9dbe6, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(2, 4, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xdff3ff, .6); rim.position.set(-3, 2, -4); scene.add(rim);
}

const blobTexture = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(40,70,90,.32)'); gr.addColorStop(1, 'rgba(40,70,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
})();
const makeBlob = (r = .32) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = .003; return m;
};

/* =========================================================
   VIGNETTES 3D (rendu hors écran, en file d'attente)
   ========================================================= */
const thumbs = (() => {
    const SIZE = 192;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(); addLights(scene);
    const cam = new THREE.PerspectiveCamera(28, 1, .05, 50);
    const cache = new Map();
    let queue = [], busy = false, gen = 0;

    const keyOf = (m, mode) => {
        const { id, name, creator, createdAt, updatedAt, favorite, birthday, ...rest } = m;
        return mode + JSON.stringify(rest);
    };
    function render(m, mode) {
        const g = kit.buildMii(m, { body: mode === 'full' });
        scene.add(g);
        if (mode === 'full') {
            const h = g.userData.height;
            cam.position.set(0, h * .55, h * 2.35); cam.lookAt(0, h * .5, 0);
        } else {
            const y = kit.HEAD_SCALE * 1.05;
            cam.position.set(0, y + .06, 1.95); cam.lookAt(0, y, 0);
        }
        renderer.render(scene, cam);
        const url = renderer.domElement.toDataURL('image/png');
        scene.remove(g); kit.disposeMii(g);
        return url;
    }
    function pump() {
        if (busy) return;
        busy = true;
        const step = () => {
            const t0 = performance.now();
            while (queue.length && performance.now() - t0 < 14) {
                const job = queue.shift();
                if (job.gen !== gen && !job.keep) { job.reject?.('cancel'); continue; }
                let url = cache.get(job.key);
                if (!url) { url = render(job.m, job.mode); cache.set(job.key, url); if (cache.size > 600) cache.delete(cache.keys().next().value); }
                job.resolve(url);
            }
            if (queue.length) requestAnimationFrame(step); else busy = false;
        };
        requestAnimationFrame(step);
    }
    return {
        async get(m, mode = 'head', keep = false) {
            const key = keyOf(m, mode);
            if (cache.has(key)) return cache.get(key);
            // Cache persistant (IndexedDB) : pas de rendu 3D si la vignette existe déjà
            const pkey = thumbKey(m, mode, SIZE);
            const stored = await getThumb(pkey);
            if (stored) { cache.set(key, stored); return stored; }
            const myGen = gen;
            const url = await new Promise((resolve, reject) => { queue.push({ m: cloneMii(m), mode, key, resolve, reject, gen: myGen, keep }); pump(); });
            putThumb(pkey, url);
            return url;
        },
        cancelPending() { gen++; },
    };
})();

/* =========================================================
   PLAZA : les Mii se promènent
   ========================================================= */
const plaza = (() => {
    const host = $('#plaza-stage');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.prepend(renderer.domElement);
    const scene = new THREE.Scene(); addLights(scene);
    const cam = new THREE.PerspectiveCamera(34, 1, .1, 100);
    cam.position.set(0, 3.4, 8.2);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.target.set(0, .55, 0);
    controls.enablePan = false; controls.enableDamping = true;
    controls.minDistance = 3.5; controls.maxDistance = 12;
    controls.minPolarAngle = .5; controls.maxPolarAngle = 1.38;

    const floor = new THREE.Mesh(new THREE.CircleGeometry(6.2, 64), new THREE.MeshStandardMaterial({ color: '#f7fbfd', roughness: .95 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.2, 6.45, 64), new THREE.MeshBasicMaterial({ color: '#bfe3ee' }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .002; scene.add(ring);

    const actors = new Map();
    let selected = null;
    const R = 4.6;
    const randPt = () => { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R; return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r); };

    function setMiis(list) {
        const keep = new Set(list.map((m) => m.id));
        for (const [id, a] of actors) if (!keep.has(id)) { scene.remove(a.root); kit.disposeMii(a.mii); actors.delete(id); }
        list.slice(0, 40).forEach((m) => {
            const sig = JSON.stringify(m);
            const prev = actors.get(m.id);
            if (prev && prev.sig === sig) return;
            const mii = kit.buildMii(m);
            const root = new THREE.Group(); root.add(mii); root.add(makeBlob());
            root.userData.id = m.id;
            if (prev) { root.position.copy(prev.root.position); root.rotation.y = prev.root.rotation.y; scene.remove(prev.root); kit.disposeMii(prev.mii); }
            else { const p = randPt(); root.position.set(p.x, 0, p.y); root.rotation.y = Math.random() * 6.28; }
            scene.add(root);
            actors.set(m.id, { root, mii, sig, target: randPt(), wait: Math.random() * 3, speed: .55 + Math.random() * .35, data: m });
        });
    }

    function select(id) { selected = id; }

    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let downAt = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', (e) => {
        if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
        const r = renderer.domElement.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, cam);
        const hits = ray.intersectObjects([...actors.values()].map((a) => a.root), true);
        let o = hits[0]?.object;
        while (o && !o.userData.id) o = o.parent;
        if (o) { sfx('pop'); app.selectMii(o.userData.id); }
        else app.selectMii(null);
    });
    renderer.domElement.addEventListener('dblclick', () => { if (selected) app.edit(selected); });

    const label = $('#plaza-label');
    const tmp = new THREE.Vector3();
    function tick(dt) {
        const list = [...actors.values()];
        for (const a of list) {
            const p = a.root.position;
            const isSel = a.root.userData.id === selected;
            let walking = false;
            if (isSel) {
                const want = Math.atan2(cam.position.x - p.x, cam.position.z - p.z);
                a.root.rotation.y += angleDiff(want, a.root.rotation.y) * Math.min(1, dt * 5);
            } else if (a.wait > 0) a.wait -= dt;
            else {
                const dx = a.target.x - p.x, dz = a.target.y - p.z, d = Math.hypot(dx, dz);
                if (d < .1) { a.wait = 1.5 + Math.random() * 4; a.target = randPt(); }
                else {
                    walking = true;
                    const want = Math.atan2(dx, dz);
                    a.root.rotation.y += angleDiff(want, a.root.rotation.y) * Math.min(1, dt * 4);
                    p.x += Math.sin(a.root.rotation.y) * a.speed * dt; p.z += Math.cos(a.root.rotation.y) * a.speed * dt;
                }
            }
            // évite que deux Mii se marchent dessus
            for (const b of list) {
                if (b === a) continue;
                const q = b.root.position, dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz);
                if (d > 0 && d < .55) { const k = (.55 - d) * .5; p.x += dx / d * k; p.z += dz / d * k; }
            }
            const r = Math.hypot(p.x, p.z); if (r > R + .6) { p.x *= (R + .6) / r; p.z *= (R + .6) / r; }
            kit.tickMii(a.mii, dt, { walk: walking });
        }
        controls.update();
        const sel = actors.get(selected);
        if (sel) {
            tmp.set(0, sel.mii.userData.height + .12, 0); sel.root.localToWorld(tmp); tmp.project(cam);
            const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
            label.style.left = ((tmp.x + 1) / 2 * w) + 'px'; label.style.top = ((1 - tmp.y) / 2 * h) + 'px';
            label.textContent = sel.data.name; label.hidden = false;
        } else label.hidden = true;
        renderer.render(scene, cam);
    }
    function resize() {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    return { setMiis, select, tick, resize };
})();

function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

/* =========================================================
   SCÈNE DE L'ÉDITEUR
   ========================================================= */
const stage = (() => {
    const host = $('#ed-stage');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.prepend(renderer.domElement);
    const scene = new THREE.Scene(); addLights(scene);
    scene.add(makeBlob(.45));
    const cam = new THREE.PerspectiveCamera(30, 1, .05, 50);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enablePan = false; controls.enableDamping = true;
    controls.minPolarAngle = .9; controls.maxPolarAngle = 1.75;
    controls.minDistance = .9; controls.maxDistance = 6;

    let mii = null, data = null, dirty = false, zoom = 'face', spin = false, fresh = true;
    const goal = { target: new THREE.Vector3(), dist: 2 };

    function frame() {
        if (!mii) return;
        const u = mii.userData;
        const narrow = host.clientWidth < host.clientHeight * .9;
        if (zoom === 'face') { goal.target.set(0, u.headCenterY + .02, 0); goal.dist = narrow ? 3.0 : 2.35; }
        else { goal.target.set(0, u.height * .5, 0); goal.dist = u.height * (narrow ? 2.9 : 2.25); }
    }
    function set(m) { data = m; dirty = true; }
    function rebuild() {
        dirty = false;
        const old = mii;
        mii = kit.buildMii(data);
        if (old) { mii.rotation.y = old.rotation.y; mii.userData.t = old.userData.t; scene.remove(old); kit.disposeMii(old); }
        scene.add(mii);
        frame();
        if (fresh) {
            fresh = false;
            controls.target.copy(goal.target);
            cam.position.copy(goal.target).add(new THREE.Vector3(0, .05, goal.dist));
        }
    }
    function setZoom(z) { zoom = z; frame(); }
    function tick(dt) {
        if (dirty && data) rebuild();
        if (!mii) return;
        controls.target.lerp(goal.target, Math.min(1, dt * 5));
        const off = cam.position.clone().sub(controls.target);
        const d = off.length();
        off.setLength(d + (goal.dist - d) * Math.min(1, dt * 4));
        cam.position.copy(controls.target).add(off);
        if (spin) mii.rotation.y += dt * .8;
        else mii.rotation.y += angleDiff(0, mii.rotation.y) * Math.min(1, dt * 3);
        kit.tickMii(mii, dt);
        controls.update();
        renderer.render(scene, cam);
    }
    function resize() {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); frame();
    }
    return {
        set, tick, resize, setZoom,
        get zoom() { return zoom; },
        toggleSpin() { spin = !spin; return spin; },
        reset() { fresh = true; spin = false; },
    };
})();

/* =========================================================
   ICÔNES DES ONGLETS (SVG maison)
   ========================================================= */
const ICON = {
    profile: '<circle cx="16" cy="11" r="6"/><path d="M5 28c1-6 5.5-9 11-9s10 3 11 9"/>',
    body: '<circle cx="16" cy="6" r="3.5"/><path d="M10 13h12l-2 8h-8zM13 21v8M19 21v8M10 13l-3 7M22 13l3 7"/>',
    face: '<ellipse cx="16" cy="16" rx="10" ry="12"/><circle cx="12" cy="14" r="1.4" fill="currentColor"/><circle cx="20" cy="14" r="1.4" fill="currentColor"/><path d="M12 21q4 3 8 0"/>',
    hair: '<path d="M5 20C4 9 10 4 16 4s12 5 11 16c-2-5-5-8-11-8s-9 3-11 8z" fill="currentColor"/><path d="M6 20v6M26 20v6"/>',
    brows: '<path d="M4 15q5-5 10-2M18 13q5-3 10 2" stroke-width="3.2"/><circle cx="9" cy="21" r="2" fill="currentColor"/><circle cx="23" cy="21" r="2" fill="currentColor"/>',
    eyes: '<path d="M3 16q6-8 12 0-6 8-12 0zM17 16q6-8 12 0-6 8-12 0z"/><circle cx="9" cy="16" r="2.4" fill="currentColor"/><circle cx="23" cy="16" r="2.4" fill="currentColor"/>',
    nose: '<path d="M16 6c-1 7-5 12-5 15 0 3 3 4 5 4s5-1 5-4"/>',
    mouth: '<path d="M6 14q10 12 20 0z" fill="currentColor" fill-opacity=".25"/><path d="M6 14q10 12 20 0"/>',
    beard: '<path d="M6 10c0 12 4 18 10 18s10-6 10-18c-3 6-6 7-10 7s-7-1-10-7z" fill="currentColor" fill-opacity=".3"/><path d="M9 14q7-4 14 0"/>',
    glasses: '<circle cx="9" cy="17" r="5"/><circle cx="23" cy="17" r="5"/><path d="M14 16q2-2 4 0M4 15l-2-3M28 15l2-3"/>',
    mole: '<ellipse cx="16" cy="16" rx="10" ry="12"/><circle cx="21" cy="20" r="2.2" fill="currentColor"/>',
    hat: '<path d="M8 21c0-9 3-14 8-14s8 5 8 14z" fill="currentColor" fill-opacity=".3"/><path d="M3 22h26"/><path d="M8 21c0-9 3-14 8-14s8 5 8 14"/>',
};
const icon = (k) => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

/* =========================================================
   ÉDITEUR : état, historique, onglets
   ========================================================= */
const getP = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const setP = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

const ed = {
    cur: null, savedSig: '', isNew: false, tab: 'face',
    hist: [], hi: -1,
};
const sig = (m) => { const { updatedAt, ...r } = m; return JSON.stringify(r); };
const isDirty = () => ed.cur && sig(ed.cur) !== ed.savedSig;

function commit() {
    const s = JSON.stringify(ed.cur);
    if (ed.hist[ed.hi] === s) return;
    ed.hist = ed.hist.slice(0, ed.hi + 1); ed.hist.push(s);
    if (ed.hist.length > 120) ed.hist.shift();
    ed.hi = ed.hist.length - 1;
    updateUndo();
}
function undo(dir) {
    const i = ed.hi + dir;
    if (i < 0 || i >= ed.hist.length) return;
    ed.hi = i; ed.cur = JSON.parse(ed.hist[i]);
    stage.set(ed.cur); renderTab(); updateName(); updateUndo();
}
function updateUndo() { $('#btn-undo').disabled = ed.hi <= 0; $('#btn-redo').disabled = ed.hi >= ed.hist.length - 1; }
function updateName() { $('#ed-name').textContent = ed.cur.name || 'Mii'; }

/* Change une valeur ; full=true reconstruit l'onglet (vignettes qui dépendent de la couleur) */
function change(path, value, { full = false, history = true } = {}) {
    setP(ed.cur, path, value);
    stage.set(ed.cur);
    if (history) commit();
    if (full) renderTab(); else refreshSelection();
    if (path === 'name') updateName();
}

function refreshSelection() {
    $$('[data-path]', $('#tab-body')).forEach((n) => {
        const v = getP(ed.cur, n.dataset.path);
        if (n.dataset.val !== undefined) n.classList.toggle('is-on', String(v) === n.dataset.val);
    });
    $$('input[type=range][data-bind]', $('#tab-body')).forEach((r) => { r.value = getP(ed.cur, r.dataset.bind); paintRange(r); });
}
const paintRange = (r) => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');

/* ---------- briques d'interface ---------- */
const section = (title, ...kids) => el('div', { class: 'sec' }, title ? el('h3', { class: 'sec-title' }, title) : null, ...kids);

function grid(path, count, mode, variant = (m) => m, { noneFirst = false } = {}) {
    const g = el('div', { class: 'grid' });
    for (let i = 0; i < count; i++) {
        const b = el('button', { class: 'opt', 'data-path': path, 'data-val': String(i), 'aria-label': `${i + 1}`, onclick: () => { sfx('pop'); change(path, i); } });
        if (noneFirst && i === 0) b.append(el('div', { class: 'opt-none' }, '∅'));
        else if (mode === '2d') {
            const part = path.split('.')[0];
            const c = el('canvas', { width: 96, height: 96 });
            drawPartIcon(c.getContext('2d'), part, i, ed.cur, 96);
            b.style.background = ed.cur.face.skin; b.append(c);
        } else {
            b.classList.add('is-loading');
            const v = cloneMii(ed.cur); setP(v, path, i); variant(v);
            thumbs.get(v, mode).then((url) => { b.classList.remove('is-loading'); b.append(el('img', { src: url, alt: '', draggable: 'false' })); }).catch(() => {});
        }
        g.append(b);
    }
    return g;
}

function swatches(path, palette, { custom = true, full = true } = {}) {
    const row = el('div', { class: 'swatches' });
    palette.forEach((c, i) => {
        const val = typeof getP(ed.cur, path) === 'number' ? String(i) : c;
        const b = el('button', { class: 'sw', 'data-path': path, 'data-val': val, style: `background:${c}`, 'aria-label': c,
            onclick: () => { sfx('pop'); change(path, typeof getP(ed.cur, path) === 'number' ? i : c, { full }); } });
        row.append(b);
    });
    if (custom) {
        const inp = el('input', { type: 'color', value: getP(ed.cur, path), 'aria-label': 'Couleur personnalisée' });
        inp.addEventListener('input', () => change(path, inp.value, { history: false }));
        inp.addEventListener('change', () => change(path, inp.value, { full }));
        row.append(el('label', { class: 'sw sw-custom', title: '+' }, inp));
    }
    return row;
}

function slider(path, label) {
    const [lo, hi] = RANGES[path];
    const r = el('input', { type: 'range', min: lo, max: hi, step: 1, value: getP(ed.cur, path), 'data-bind': path, 'aria-label': label });
    paintRange(r);
    r.addEventListener('input', () => { paintRange(r); change(path, +r.value, { history: false }); });
    r.addEventListener('change', () => commit());
    const step = (d) => el('button', { class: 'step', 'aria-label': d > 0 ? '+' : '−', onclick: () => {
        const v = Math.max(lo, Math.min(hi, getP(ed.cur, path) + d)); sfx('pop'); change(path, v);
    } }, d > 0 ? '+' : '−');
    return el('div', { class: 'slider' }, el('label', {}, label), step(-1), r, step(1));
}

function toggle(path, label, { full = false } = {}) {
    const inp = el('input', { type: 'checkbox' }); inp.checked = !!getP(ed.cur, path);
    inp.addEventListener('change', () => { sfx('pop'); change(path, inp.checked, { full }); });
    return el('label', { class: 'toggle' }, inp, label);
}

/* ---------- contenu de chaque onglet ---------- */
const noHat = (m) => { m.hat.type = 0; };
const TABS = {
    profile: () => {
        const name = el('input', { class: 'text', maxlength: 10, value: ed.cur.name, spellcheck: 'false' });
        name.addEventListener('input', () => change('name', name.value, { history: false }));
        name.addEventListener('change', commit);
        const creator = el('input', { class: 'text', maxlength: 10, value: ed.cur.creator, spellcheck: 'false' });
        creator.addEventListener('input', () => change('creator', creator.value, { history: false }));
        creator.addEventListener('change', commit);
        const seg = el('div', { class: 'seg' }, ...['m', 'f'].map((g) => el('button', { 'data-path': 'gender', 'data-val': g, onclick: () => { sfx('pop'); change('gender', g); } }, t(g === 'm' ? 'male' : 'female'))));
        const day = el('select', { class: 'select', 'aria-label': t('day') }, ...Array.from({ length: 32 }, (_, i) => el('option', { value: i }, i ? String(i) : '—')));
        day.value = ed.cur.birthday.d; day.addEventListener('change', () => change('birthday.d', +day.value));
        const month = el('select', { class: 'select', 'aria-label': t('month') }, ...t('months').map((n, i) => el('option', { value: i }, n)));
        month.value = ed.cur.birthday.m; month.addEventListener('change', () => change('birthday.m', +month.value));
        return [
            el('label', { class: 'field' }, el('span', {}, t('name')), name),
            el('label', { class: 'field' }, el('span', {}, t('creator')), creator),
            section(t('gender'), seg),
            section(t('birthday'), el('div', { class: 'row' }, day, month)),
            section(t('favColor'), swatches('favColor', FAV_COLORS, { custom: false, full: false })),
            toggle('favorite', t('favorite')),
        ];
    },
    body: () => [
        section(null, slider('body.height', t('height')), slider('body.build', t('build'))),
        section(t('favColor'), swatches('favColor', FAV_COLORS, { custom: false, full: false })),
        section(t('pants'), swatches('body.pants', PANTS_COLORS, { custom: false, full: false })),
    ],
    face: () => [
        section(t('shape'), grid('face.shape', COUNTS.faceShape, 'head', noHat)),
        section(t('skin'), swatches('face.skin', SKIN_COLORS)),
        section(t('features'), grid('face.feature', COUNTS.faceFeature, 'head', noHat)),
    ],
    hair: () => [
        section(t('hairStyle'), grid('hair.style', COUNTS.hair, 'head', noHat)),
        section(t('hairColor'), swatches('hair.color', HAIR_COLORS)),
        toggle('hair.flip', t('flip'), { full: true }),
    ],
    brows: () => [
        section(t('type'), grid('brows.type', COUNTS.brows, '2d')),
        section(t('color'), swatches('brows.color', HAIR_COLORS)),
        section(null, slider('brows.size', t('size')), slider('brows.rot', t('rot')), slider('brows.spacing', t('spacing')), slider('brows.y', t('vpos'))),
    ],
    eyes: () => [
        section(t('type'), grid('eyes.type', COUNTS.eyes, '2d')),
        section(t('color'), swatches('eyes.color', EYE_COLORS)),
        section(null, slider('eyes.size', t('size')), slider('eyes.rot', t('rot')), slider('eyes.spacing', t('spacing')), slider('eyes.y', t('vpos'))),
    ],
    nose: () => [
        section(t('type'), grid('nose.type', COUNTS.nose, 'head', noHat)),
        section(null, slider('nose.size', t('size')), slider('nose.y', t('vpos'))),
    ],
    mouth: () => [
        section(t('type'), grid('mouth.type', COUNTS.mouth, '2d')),
        section(t('color'), swatches('mouth.color', LIP_COLORS)),
        section(null, slider('mouth.size', t('size')), slider('mouth.y', t('vpos'))),
    ],
    beard: () => [
        section(t('mustache'), grid('mustache.type', COUNTS.mustache, '2d', undefined, { noneFirst: true })),
        section(null, slider('mustache.size', t('size')), slider('mustache.y', t('vpos'))),
        section(t('beard'), grid('beard.type', COUNTS.beard, 'head', noHat, { noneFirst: true })),
        section(t('facialHair'), swatches('facialHairColor', HAIR_COLORS)),
    ],
    glasses: () => [
        section(t('glassesType'), grid('glasses.type', COUNTS.glasses, 'head', noHat, { noneFirst: true })),
        section(t('color'), swatches('glasses.color', GLASSES_COLORS)),
        toggle('glasses.tint', t('tint')),
        section(null, slider('glasses.size', t('size')), slider('glasses.y', t('vpos'))),
    ],
    mole: () => [
        toggle('mole.on', t('moleOn')),
        section(null, slider('mole.size', t('size')), slider('mole.x', t('hpos')), slider('mole.y', t('vpos'))),
    ],
    hat: () => [
        section(t('hatType'), grid('hat.type', COUNTS.hat + (isSelfAdmin() ? ADMIN_HATS.length : 0), 'head', undefined, { noneFirst: true })),
        section(t('color'), swatches('hat.color', HAT_COLORS)),
        el('p', { class: 'hint' }, t('hatHint')),
    ],
};
const TAB_ORDER = ['profile', 'body', 'face', 'hair', 'brows', 'eyes', 'nose', 'mouth', 'beard', 'glasses', 'mole', 'hat'];
const ZOOM_FOR = { profile: 'body', body: 'body', hat: 'face' };

function renderTabs() {
    const bar = $('#tabs'); bar.innerHTML = '';
    TAB_ORDER.forEach((id) => {
        const b = el('button', { class: 'tab' + (id === ed.tab ? ' is-on' : ''), role: 'tab', 'aria-selected': String(id === ed.tab), title: t('tabs')[id],
            onclick: () => { if (ed.tab === id) return; sfx('click'); ed.tab = id; renderTabs(); renderTab(); stage.setZoom(ZOOM_FOR[id] || 'face'); syncZoomBtn(); } });
        b.innerHTML = icon(id) + `<span>${t('tabs')[id]}</span>`;
        bar.append(b);
    });
}
function renderTab() {
    thumbs.cancelPending();
    const body = $('#tab-body');
    const scroll = body.scrollTop;
    body.innerHTML = '';
    body.append(...TABS[ed.tab]());
    body.scrollTop = scroll;
    refreshSelection();
}
const syncZoomBtn = () => $('#btn-zoom').classList.toggle('is-on', stage.zoom === 'body');

/* =========================================================
   APPLICATION
   ========================================================= */
let current = 'plaza';
function show(view) {
    current = view;
    $$('.view').forEach((v) => v.classList.toggle('view--active', v.id === view));
    requestAnimationFrame(() => { plaza.resize(); stage.resize(); });
}

const app = {
    miis: [], mainId: null, sel: null,

    async refresh() {
        this.miis = await miiStore.list();
        this.mainId = await miiStore.getMainId();
        if (this.sel && !this.miis.some((m) => m.id === this.sel)) this.sel = null;
        this.renderRoster();
        plaza.setMiis(this.sortedMiis());
        $('#plaza-empty').hidden = this.miis.length > 0;
    },
    sortedMiis() {
        const by = $('#roster-sort').value;
        const l = [...this.miis];
        if (by === 'name') l.sort((a, b) => a.name.localeCompare(b.name));
        else if (by === 'fav') l.sort((a, b) => (b.favorite - a.favorite) || (b.updatedAt - a.updatedAt));
        else l.sort((a, b) => b.updatedAt - a.updatedAt);
        const i = l.findIndex((m) => m.id === this.mainId);
        if (i > 0) l.unshift(...l.splice(i, 1));
        return l;
    },
    renderRoster() {
        const ul = $('#roster-list'); ul.innerHTML = '';
        $('#roster-count').textContent = t('count', this.miis.length);
        for (const m of this.sortedMiis()) {
            const img = el('img', { alt: '', draggable: 'false' });
            thumbs.get(m, 'head', true).then((u) => { img.src = u; }).catch(() => {});
            const li = el('li', { class: 'roster-item' + (m.id === this.sel ? ' is-sel' : ''), tabindex: 0, role: 'button', 'aria-label': m.name,
                onclick: () => { sfx('pop'); this.selectMii(m.id); }, ondblclick: () => this.edit(m.id),
                onkeydown: (e) => { if (e.key === 'Enter') this.edit(m.id); } },
                img, el('span', {}, m.name),
                m.id === this.mainId ? el('b', { class: 'badge badge--main', title: t('setMain') }, '★') : null,
                m.favorite ? el('b', { class: 'badge badge--fav' }, '♥') : null);
            ul.append(li);
        }
        this.syncTools();
    },
    selectMii(id) {
        this.sel = id;
        plaza.select(id);
        $$('.roster-item').forEach((li, i) => li.classList.toggle('is-sel', this.sortedMiis()[i]?.id === id));
        this.syncTools();
    },
    syncTools() { $$('[data-needs-sel]').forEach((b) => { b.disabled = !this.sel; }); },
    get selMii() { return this.miis.find((m) => m.id === this.sel); },

    open(m, isNew) {
        ed.cur = cloneMii(m); ed.isNew = isNew; ed.savedSig = isNew ? '' : sig(m);
        ed.hist = []; ed.hi = -1; commit();
        ed.tab = isNew ? 'face' : 'face';
        stage.reset(); stage.set(ed.cur); stage.setZoom('face');
        renderTabs(); renderTab(); updateName(); syncZoomBtn();
        $('#btn-spin').classList.remove('is-on');
        show('editor');
    },
    edit(id) { const m = this.miis.find((x) => x.id === id); if (m) { sfx('click'); this.open(m, false); } },
    async save() {
        if (!ed.cur.name.trim()) ed.cur.name = 'Mii';
        try {
            const m = await miiStore.save(ed.cur);
            ed.savedSig = sig(m);
            sfx('click'); toast(t('saved'));
            await this.refresh(); this.selectMii(m.id);
            show('plaza');
        } catch (e) { toast(e.message === 'full' ? t('full') : t('storageErr')); }
    },
    quit() {
        const go = () => { sfx('back'); show('plaza'); };
        if (!isDirty()) return go();
        modal([el('h2', {}, t('quitTitle')), el('p', {}, t('quitSub'))], [
            [t('keep'), 'pill', close],
            [t('quit'), 'pill pill--danger', () => { close(); go(); }],
        ]);
    },
};

/* =========================================================
   MODALES & TOAST
   ========================================================= */
function modal(content, actions = []) {
    const card = $('#modal-card'); card.innerHTML = '';
    card.append(...content);
    if (actions.length) card.append(el('div', { class: 'modal-actions' }, ...actions.map(([label, cls, fn]) => el('button', { class: cls, onclick: fn }, label))));
    $('#modal').hidden = false;
    setTimeout(() => card.querySelector('textarea, .pill--primary, button')?.focus(), 30);
}
function close() { $('#modal').hidden = true; }
$('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') close(); });

let toastT;
function toast(msg) {
    const n = $('#toast'); n.textContent = msg; n.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => n.classList.remove('is-on'), 2200);
}

function newMiiModal() {
    const choice = (label, m, onClick) => {
        const img = el('img', { alt: '' });
        thumbs.get(m, 'head', true).then((u) => { img.src = u; });
        return el('button', { class: 'choice', onclick: onClick }, img, label);
    };
    const male = defaultMii('m'), female = defaultMii('f'), rnd = randomMii();
    modal([
        el('h2', {}, t('newTitle')), el('p', {}, t('newSub')),
        el('div', { class: 'choice-row' },
            choice(t('male'), male, () => { close(); app.open(defaultMii('m'), true); }),
            choice(t('female'), female, () => { close(); app.open(defaultMii('f'), true); }),
            choice(t('lookalike'), rnd, () => lookalikeModal())),
        el('p', { style: 'margin:16px 0 8px' }, t('fromGuest')),
        el('div', { class: 'grid' }, ...GUEST_MIIS.map((g) => {
            const b = el('button', { class: 'opt is-loading', title: g.name, onclick: () => {
                const m = cloneMii(g); m.id = newId(); m.creator = ''; m.createdAt = m.updatedAt = Date.now();
                close(); sfx('click'); app.open(m, true);
            } });
            thumbs.get(g, 'head', true).then((u) => { b.classList.remove('is-loading'); b.append(el('img', { src: u, alt: g.name })); });
            return b;
        })),
    ], [[t('close'), 'pill', close]]);
}

function lookalikeModal() {
    const gridEl = el('div', { class: 'lookalikes' });
    const fill = () => {
        gridEl.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const m = randomMii();
            const b = el('button', { class: 'opt is-loading', onclick: () => { close(); sfx('click'); app.open(m, true); } });
            thumbs.get(m, 'head', true).then((u) => { b.classList.remove('is-loading'); b.append(el('img', { src: u, alt: '' })); });
            gridEl.append(b);
        }
    };
    fill();
    modal([el('h2', {}, t('pick')), gridEl], [[t('reroll'), 'pill', () => { sfx('pop'); fill(); }], [t('close'), 'pill', close]]);
}


/* =========================================================
   COMPTE (facultatif)
   ========================================================= */
let account = null;
let accountFailed = false;
const GOOGLE_SVG = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

function renderAccountState() {
    const dot = $('#acc-dot'), lbl = $('#acc-label'), st = $('#roster-storage');
    if (!dot) return;
    const u = account?.user;
    const sync = miiStore.syncState;
    dot.className = 'acc-dot' + (u ? (sync === 'error' ? ' err' : ' on') : '');
    lbl.textContent = u ? (account.displayName().split('@')[0].slice(0, 14) || t('connected')) : t('account');
    st.textContent = !u ? t('storageLocal') : sync === 'syncing' ? t('syncing') : sync === 'error' ? t('syncErr') : t('storageCloud');
}

function accountModal(tab = 'in') {
    if (!account) { modal([el('h2', {}, t('accTitle')), el('p', {}, accountFailed ? t('offline') : t('syncing'))], [[t('close'), 'pill', close]]); return; }
    const u = account.user;
    if (u) {
        const name = account.displayName();
        const sync = miiStore.syncState;
        modal([
            el('h2', {}, t('accTitle')),
            el('div', { class: 'acc-user' }, el('div', { class: 'acc-avatar' }, (name[0] || '?').toUpperCase()),
                el('div', {}, el('b', {}, name), el('small', {}, sync === 'error' ? t('syncErr') : sync === 'syncing' ? t('syncing') : t('syncOk')))),
        ], [
            [t('syncBtn'), 'pill', async () => { await miiStore.sync(); close(); toast(miiStore.syncState === 'error' ? t('syncErr') : t('syncOk')); }],
            [t('signOut'), 'pill pill--danger', async () => { try { await account.signOut(); } catch { /* ignore */ } close(); toast(t('bye')); }],
            [t('close'), 'pill pill--primary', close],
        ]);
        return;
    }
    const email = el('input', { class: 'text', type: 'email', autocomplete: 'email', placeholder: t('email') });
    const pass = el('input', { class: 'text', type: 'password', autocomplete: tab === 'up' ? 'new-password' : 'current-password', placeholder: t('password'), minlength: 6 });
    const err = el('p', { class: 'acc-err' });
    const submit = el('button', { class: 'pill pill--primary', type: 'submit' }, tab === 'up' ? t('signUp') : t('signIn'));
    const form = el('form', { class: 'acc-form', onsubmit: async (e) => {
        e.preventDefault();
        if (!email.value.trim() || !pass.value) { err.textContent = t('fill'); return; }
        submit.disabled = true; err.textContent = '';
        try {
            if (tab === 'up') {
                const d = await account.signUp(email.value.trim(), pass.value);
                close(); toast(d.session ? t('welcome', email.value.trim()) : t('checkMail'));
            } else {
                await account.signIn(email.value.trim(), pass.value);
                close(); toast(t('welcome', email.value.trim()));
            }
        } catch (x) { err.textContent = x.message; submit.disabled = false; }
    } }, email, pass, err, submit,
        tab === 'in' ? el('button', { class: 'acc-link', type: 'button', onclick: async () => {
            if (!email.value.trim()) { err.textContent = t('fill'); return; }
            try { await account.resetPassword(email.value.trim()); toast(t('resetSent')); } catch (x) { err.textContent = x.message; }
        } }, t('forgot')) : null);
    const g = el('button', { class: 'pill acc-google', type: 'button', onclick: async () => { try { await account.google(); } catch (x) { err.textContent = x.message; } } });
    g.innerHTML = GOOGLE_SVG + `<span>${t('google')}</span>`;
    modal([
        el('h2', {}, t('accTitle')), el('p', {}, t('accSub')),
        el('div', { class: 'acc-tabs' },
            el('button', { class: tab === 'in' ? 'is-on' : '', onclick: () => accountModal('in') }, t('signIn')),
            el('button', { class: tab === 'up' ? 'is-on' : '', onclick: () => accountModal('up') }, t('signUp'))),
        g, el('div', { class: 'acc-or' }, t('or')), form,
    ], [[t('close'), 'pill', close]]);
    setTimeout(() => email.focus(), 40);
}

function recoveryModal() {
    const pass = el('input', { class: 'text', type: 'password', autocomplete: 'new-password', placeholder: t('newPass'), minlength: 6 });
    const err = el('p', { class: 'acc-err' });
    modal([el('h2', {}, t('newPass')), el('div', { class: 'acc-form' }, pass, err)], [
        [t('cancel'), 'pill', close],
        [t('setPass'), 'pill pill--primary', async () => {
            try { await account.updatePassword(pass.value); close(); toast(t('passSaved')); } catch (x) { err.textContent = x.message; }
        }],
    ]);
}

import('@supabase/supabase-js').then(({ createClient }) => {
    account = createAccount(createClient);
    attachAccount(account);
    account.onChange((_u, event) => {
        renderAccountState();
        if (event === 'PASSWORD_RECOVERY') recoveryModal();
        if (event === 'SIGNED_IN' && location.search.includes('code=')) history.replaceState(null, '', location.pathname);
    });
    account.ready.then(renderAccountState);
}).catch(() => { accountFailed = true; renderAccountState(); });
$('#btn-account').addEventListener('click', () => { sfx('pop'); accountModal(); });
if (location.hash === '#account') setTimeout(() => accountModal(), 600);

/* =========================================================
   BRANCHEMENTS
   ========================================================= */
const actions = {
    new: () => { sfx('click'); newMiiModal(); },
    edit: () => app.sel && app.edit(app.sel),
    main: async () => { const m = app.selMii; if (!m) return; await miiStore.setMain(m.id); sfx('click'); toast(t('mainSet', m.name)); app.refresh(); },
    fav: async () => { const m = app.selMii; if (!m) return; m.favorite = !m.favorite; await miiStore.save(m); sfx('pop'); app.refresh(); },
    dup: async () => {
        const m = app.selMii; if (!m) return;
        const c = cloneMii(m); c.id = newId(); c.name = t('copyOf', m.name); c.createdAt = Date.now(); c.favorite = false;
        try { const s = await miiStore.save(c); sfx('click'); await app.refresh(); app.selectMii(s.id); } catch (e) { toast(e.message === 'full' ? t('full') : t('storageErr')); }
    },
    share: () => {
        const m = app.selMii; if (!m) return;
        const code = encodeMii(m);
        const ta = el('textarea', { class: 'text', readonly: true }); ta.value = code;
        modal([el('h2', {}, t('shareTitle')), el('p', {}, t('shareSub')), ta], [
            [t('close'), 'pill', close],
            [t('copy'), 'pill pill--primary', async () => {
                try { await navigator.clipboard.writeText(code); } catch { ta.select(); document.execCommand?.('copy'); }
                toast(t('copied'));
            }],
        ]);
    },
    import: () => {
        const ta = el('textarea', { class: 'text', placeholder: 'MII1.…', spellcheck: 'false' });
        modal([el('h2', {}, t('importTitle')), el('p', {}, t('importSub')), ta], [
            [t('cancel'), 'pill', close],
            [t('importBtn'), 'pill pill--primary', async () => {
                let m;
                try { m = decodeMii(ta.value); } catch { toast(t('badCode')); return; }
                try { const s = await miiStore.save(m); close(); sfx('click'); await app.refresh(); app.selectMii(s.id); } catch (e) { toast(e.message === 'full' ? t('full') : t('storageErr')); }
            }],
        ]);
    },
    delete: () => {
        const m = app.selMii; if (!m) return;
        modal([el('h2', {}, t('delTitle', m.name)), el('p', {}, t('delSub'))], [
            [t('cancel'), 'pill', close],
            [t('delete'), 'pill pill--danger', async () => { close(); await miiStore.remove(m.id); sfx('back'); app.selectMii(null); app.refresh(); }],
        ]);
    },
};
$$('[data-action]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.action]()));
$('#roster-sort').addEventListener('change', () => app.renderRoster());

$('#btn-save').addEventListener('click', () => app.save());
$('#btn-quit').addEventListener('click', () => app.quit());
$('#btn-random').addEventListener('click', () => {
    const keep = { id: ed.cur.id, name: ed.cur.name, creator: ed.cur.creator, birthday: ed.cur.birthday, favorite: ed.cur.favorite, createdAt: ed.cur.createdAt };
    ed.cur = { ...randomMii(ed.cur.gender), ...keep };
    sfx('pop'); stage.set(ed.cur); commit(); renderTab();
});
$('#btn-undo').addEventListener('click', () => undo(-1));
$('#btn-redo').addEventListener('click', () => undo(1));
$('#btn-zoom').addEventListener('click', () => { stage.setZoom(stage.zoom === 'face' ? 'body' : 'face'); syncZoomBtn(); sfx('pop'); });
$('#btn-spin').addEventListener('click', (e) => { e.currentTarget.classList.toggle('is-on', stage.toggleSpin()); });
$('#btn-lang').addEventListener('click', () => {
    lang = lang === 'fr' ? 'en' : 'fr';
    try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
    applyStaticTexts(); app.renderRoster();
    if (current === 'editor') { renderTabs(); renderTab(); }
});
$('#btn-home').addEventListener('click', (e) => {
    e.preventDefault(); sfx('back');
    document.body.style.transition = 'opacity .35s'; document.body.style.opacity = '0';
    setTimeout(() => { location.href = '../index.html'; }, 350);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) { close(); return; }
    if (current !== 'editor' || e.target.matches('input[type=text], input:not([type]), textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey ? 1 : -1); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(1); }
});
window.addEventListener('beforeunload', (e) => { if (current === 'editor' && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('resize', () => { plaza.resize(); stage.resize(); });
miiStore.subscribe(() => { renderAccountState(); if (current === 'plaza') app.refresh(); });

/* Boucle unique : seule la vue affichée est rendue */
let last = performance.now();
function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!document.hidden) (current === 'plaza' ? plaza : stage).tick(dt);
    requestAnimationFrame(loop);
}

applyStaticTexts();
await app.refresh();
plaza.resize();
requestAnimationFrame(loop);
if (new URLSearchParams(location.search).has('new')) newMiiModal();
