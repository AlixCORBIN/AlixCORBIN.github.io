/* Chaîne Groupes : répartition aléatoire de noms en groupes de taille min/max.
   Hasard : crypto.getRandomValues (CSPRNG) + rejet pour un entier uniforme,
   puis Fisher-Yates. Aucun biais de modulo, aucun Math.random. */

const T = {
    fr: {
        back: '← Menu', title: 'Groupe Générator', names: 'Noms', namesPh: 'Un nom par ligne (ou séparés par des virgules)',
        min: 'Min / groupe', max: 'Max / groupe', nb: 'Nb de groupes', auto: 'auto',
        draw: 'Tirer au sort', redraw: 'Relancer', empty: 'Ajoute des noms puis lance le tirage.',
        rng: 'Tirage via crypto.getRandomValues (générateur cryptographique du navigateur), mélange de Fisher-Yates sans biais.',
        copy: 'Copier le résultat', copied: 'Copié !', group: n => 'Groupe ' + n,
        needNames: 'Il faut au moins 2 noms.',
        badMinMax: 'Le min doit être ≥ 1 et ≤ au max.',
        impossible: (n, a, b) => `Impossible de faire des groupes de ${a} à ${b} avec ${n} personnes.`,
        impossibleNb: (n, k, a, b) => `${k} groupes de ${a} à ${b} : il faudrait entre ${k * a} et ${k * b} personnes (vous êtes ${n}).`,
        plan: (k, sizes) => `${k} groupe${k > 1 ? 's' : ''} : ${sizes}`,
        dupes: n => `${n} doublon${n > 1 ? 's' : ''} ignoré${n > 1 ? 's' : ''}.`,
    },
    en: {
        back: '← Menu', title: 'Group Generator', names: 'Names', namesPh: 'One name per line (or comma-separated)',
        min: 'Min / group', max: 'Max / group', nb: 'Nb of groups', auto: 'auto',
        draw: 'Draw', redraw: 'Draw again', empty: 'Add some names, then draw.',
        rng: 'Draw via crypto.getRandomValues (browser cryptographic generator), unbiased Fisher-Yates shuffle.',
        copy: 'Copy result', copied: 'Copied!', group: n => 'Group ' + n,
        needNames: 'You need at least 2 names.',
        badMinMax: 'Min must be ≥ 1 and ≤ max.',
        impossible: (n, a, b) => `Can't make groups of ${a} to ${b} with ${n} people.`,
        impossibleNb: (n, k, a, b) => `${k} groups of ${a} to ${b}: needs ${k * a} to ${k * b} people (you are ${n}).`,
        plan: (k, sizes) => `${k} group${k > 1 ? 's' : ''}: ${sizes}`,
        dupes: n => `${n} duplicate${n > 1 ? 's' : ''} ignored.`,
    },
};

const $ = s => document.querySelector(s);
const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
let lang = store.get('lang') === 'en' ? 'en' : 'fr';
const t = (k, ...a) => { const v = T[lang][k]; return typeof v === 'function' ? v(...a) : v; };

const els = { names: $('#names'), min: $('#min'), max: $('#max'), nb: $('#nb'), hint: $('#hint'),
    count: $('#count'), draw: $('#btn-draw'), results: $('#results'), copy: $('#btn-copy') };
let lastGroups = null;

/* ---------- Hasard ---------- */
function randInt(n) { // entier uniforme dans [0, n)
    const limit = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
}
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ---------- Lecture / plan ---------- */
function readNames() {
    const raw = els.names.value.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const seen = new Set(), names = [];
    for (const n of raw) { const k = n.toLowerCase(); if (!seen.has(k)) { seen.add(k); names.push(n); } }
    return { names, dupes: raw.length - names.length };
}

// Renvoie { k, sizes } ou { error }
function plan(n, min, max, nbWanted) {
    if (n < 2) return { error: t('needNames') };
    if (!(min >= 1) || !(max >= min)) return { error: t('badMinMax') };
    let k;
    if (nbWanted) {
        k = nbWanted;
        if (k * min > n || k * max < n) return { error: t('impossibleNb', n, k, min, max) };
    } else {
        k = Math.ceil(n / max);                 // le moins de groupes possible…
        if (k * min > n) return { error: t('impossible', n, min, max) };
    }
    const base = Math.floor(n / k), extra = n % k; // …les plus équilibrés possible
    const sizes = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
    return { k, sizes };
}

function current() {
    const { names, dupes } = readNames();
    const min = parseInt(els.min.value, 10), max = parseInt(els.max.value, 10);
    const nb = parseInt(els.nb.value, 10) || 0;
    return { names, dupes, p: plan(names.length, min, max, nb) };
}

function refresh() {
    const { names, dupes, p } = current();
    els.count.textContent = names.length;
    let msg = p.error || t('plan', p.k, summarize(p.sizes));
    if (dupes) msg += ' ' + t('dupes', dupes);
    els.hint.textContent = names.length ? msg : '';
    els.hint.classList.toggle('err', !!p.error && names.length > 0);
    els.draw.disabled = !!p.error;
    store.set('groupes.names', els.names.value);
    store.set('groupes.cfg', JSON.stringify([els.min.value, els.max.value, els.nb.value]));
}
function summarize(sizes) {
    const c = {};
    sizes.forEach(s => { c[s] = (c[s] || 0) + 1; });
    return Object.keys(c).sort((a, b) => b - a).map(s => `${c[s]} × ${s}`).join(' + ');
}

/* ---------- Tirage ---------- */
function draw() {
    const { names, p } = current();
    if (p.error) return;
    const pool = shuffle(names);
    const sizes = shuffle(p.sizes);   // quels groupes ont une personne en plus : au hasard aussi
    let i = 0;
    lastGroups = sizes.map(s => pool.slice(i, i += s));
    render();
    els.draw.textContent = t('redraw');
}

function render() {
    els.results.innerHTML = '';
    if (!lastGroups) {
        els.results.innerHTML = `<div class="empty"><div class="die" aria-hidden="true"><i></i><i></i><i></i></div><p>${t('empty')}</p></div>`;
        els.copy.hidden = true;
        return;
    }
    lastGroups.forEach((g, gi) => {
        const card = document.createElement('article');
        card.className = 'group';
        card.style.setProperty('--hue', (gi * 137.5 + 190) % 360);
        card.style.animationDelay = (gi * 70) + 'ms';
        const h = document.createElement('h2');
        h.innerHTML = `<span>${t('group', gi + 1)}</span><small>${g.length}</small>`;
        const ul = document.createElement('ul');
        g.forEach(n => { const li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });
        card.append(h, ul);
        els.results.appendChild(card);
    });
    els.copy.hidden = false;
}

function copyResult() {
    if (!lastGroups) return;
    const txt = lastGroups.map((g, i) => `${t('group', i + 1)} : ${g.join(', ')}`).join('\n');
    navigator.clipboard.writeText(txt).then(() => {
        els.copy.textContent = t('copied');
        setTimeout(() => { els.copy.textContent = t('copy'); }, 1500);
    }).catch(() => {});
}

/* ---------- i18n ---------- */
function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(e => { e.placeholder = t(e.dataset.i18nPh); });
    $('#btn-lang').textContent = lang === 'fr' ? 'EN' : 'FR';
    if (lastGroups) els.draw.textContent = t('redraw');
    render();
    refresh();
}
$('#btn-lang').addEventListener('click', () => { lang = lang === 'fr' ? 'en' : 'fr'; store.set('lang', lang); applyLang(); });

/* ---------- Init ---------- */
els.names.value = store.get('groupes.names') || '';
try { const c = JSON.parse(store.get('groupes.cfg')); if (c) [els.min.value, els.max.value, els.nb.value] = c; } catch { /* ignore */ }
['input', 'change'].forEach(ev => [els.names, els.min, els.max, els.nb].forEach(e => e.addEventListener(ev, refresh)));
els.draw.addEventListener('click', draw);
els.copy.addEventListener('click', copyResult);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) draw(); });
applyLang();
