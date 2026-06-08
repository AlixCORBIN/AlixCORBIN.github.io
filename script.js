/* =========================================
   0. TRADUCTIONS / TRANSLATIONS
   ========================================= */
let currentLang = localStorage.getItem('lang') || 'fr';

const T = {
    fr: {
        'intro.hello':    'BONJOUR, JE SUIS <span class="highlight">ALIX CORBIN</span>, APPRENTI DÉVELOPPEUR.',
        'intro.inspired': 'CE PORTFOLIO EST UNE RÉINTERPRÉTATION DU MENU DE LA WII, GRANDEMENT INSPIRÉE PAR LE TRAVAIL DE <span class="highlight">TOBIAS ECHENIQUE</span>.',
        'intro.wip':      '⚠️ VEUILLEZ NOTER QUE CE SITE EST ACTUELLEMENT <span class="highlight" style="text-decoration: underline;">EN COURS DE CONSTRUCTION</span>.<br>IL ÉVOLUE CONSTAMMENT, ALORS N\'HÉSITEZ PAS À REVENIR RÉGULIÈREMENT POUR DÉCOUVRIR LES NOUVEAUTÉS\u00a0!',
        'intro.click':    'Cliquer pour continuer',
        'footer.title':   'Portfolio Alix CORBIN',
        'overlay.menu':   'Menu Wii',
        'contact.role':   'Étudiant BUT Informatique — Laval',
        'dm.hint':        '🌙 Dark Mode — NOUVEAU\u00a0!',
        'overlay.start':  'Démarrer',
        'overlay.soon':   'Bientôt\u2026',
        'overlay.cv':     'Voir mon CV',
    },
    en: {
        'intro.hello':    'HELLO, I AM <span class="highlight">ALIX CORBIN</span>, APPRENTICE DEVELOPER.',
        'intro.inspired': 'THIS PORTFOLIO IS A REINTERPRETATION OF THE WII MENU, GREATLY INSPIRED BY THE WORK OF <span class="highlight">TOBIAS ECHENIQUE</span>.',
        'intro.wip':      '⚠️ PLEASE NOTE THAT THIS SITE IS CURRENTLY <span class="highlight" style="text-decoration: underline;">UNDER CONSTRUCTION</span>.<br>IT IS CONSTANTLY EVOLVING, SO FEEL FREE TO COME BACK REGULARLY TO DISCOVER NEW FEATURES!',
        'intro.click':    'Click to continue',
        'footer.title':   "Alix CORBIN\u2019s Portfolio",
        'overlay.menu':   'Wii Menu',
        'contact.role':   'Computer Science Student — Laval',
        'dm.hint':        '🌙 Dark Mode — NEW!',
        'overlay.start':  'Start',
        'overlay.soon':   'Coming soon\u2026',
        'overlay.cv':     'View my CV',
    }
};

function t(key) {
    return (T[currentLang] && T[currentLang][key] !== undefined)
        ? T[currentLang][key]
        : (T.fr[key] || key);
}

function applyTranslations(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (T[lang] && T[lang][key] !== undefined) el.innerHTML = T[lang][key];
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('lang-active', btn.dataset.lang === lang);
    });
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyTranslations(lang);
    renderGrid();
    if (activeCard) renderOverlayContent(activeCard._channelData);
    sbPost('increment_preference', { p_event: 'lang_' + lang });
}

/* =========================================
   1. DONNÉES DES CHAÎNES
   ========================================= */
const CHANNELS = [
    {
        title: "Moi", titleEn: "Me",
        emoji: "👤",
        cardLabel: "Moi", cardLabelEn: "Me",
        link: "https://cvdesignr.com/p/69ac5851a54b9",
        type: "moi"
    },
    {
        title: "Profil Pro", titleEn: "Pro Profile",
        emoji: "💼",
        cardLabel: "Profil Pro", cardLabelEn: "Pro Profile",
        cardBgColor: "#0d0f1a",
        cardGradient: "linear-gradient(135deg, rgba(13,15,26,0.6), rgba(108,92,231,0.12))",
        cardEmojiShadow: "0 2px 10px rgba(108,92,231,0.8)",
        cardLabelColor: "#a78bfa",
        cardLabelShadow: "0 0 12px rgba(108,92,231,0.6)",
        desc: "Mon profil professionnel S4 — missions souhaitées, compétences tracées, parcours argumenté.",
        descEn: "My S4 professional profile — desired missions, tracked skills, argued path.",
        link: "profil/index.html",
        type: "profil",
        overlayTitle: "MON PROFIL PRO", overlayTitleEn: "MY PRO PROFILE",
        overlayTitleSize: "2.2rem",
        overlayTitleLetterSpacing: "2px",
        overlayColor: "#a78bfa",
        overlayTitleShadow: "0 0 20px rgba(108,92,231,0.6)",
        overlayEmojiShadow: "0 4px 15px rgba(108,92,231,0.7)",
        overlayBgOpacity: 0.15
    },
    {
        title: "BUT Informatique", titleEn: "CS Bachelor",
        emoji: "🎓",
        cardLabel: "BUT Info", cardLabelEn: "CS Degree",
        bg: "assets/but_bg.png",
        cardBgOpacity: 0.7,
        desc: "Compétences, Projets & Parcours.<br>Découvre le détail de ma formation et mon évolution.",
        descEn: "Skills, Projects & Path.<br>Discover my training details and evolution.",
        link: "BUT/index.html",
        type: "image-bg",
        overlayTitle: "BUT INFORMATIQUE", overlayTitleEn: "CS BACHELOR'S DEGREE",
        overlayTitleSize: "2.5rem",
        overlayTitleLetterSpacing: "2px",
        overlayColor: "#4ac0e0",
        overlayBgOpacity: 0.4
    },
    {
        title: "Blackjack",
        bg: "assets/bj.png",
        link: "blackjack/index.html",
        type: "blackjack"
    },
    {
        title: "TicTacToe",
        link: "assets/tictactoe_alixCorbin.zip",
        type: "tictactoe"
    },
    {
        title: "Culture",
        emoji: "🎬",
        cardLabel: "Culture", cardLabelEn: "Culture",
        bg: "assets/culture_bg.png",
        cardBgOpacity: 0.6,
        desc: "Cinéma, Séries & Réflexions.<br>Découvre mes analyses et les leçons que j'en tire.",
        descEn: "Cinema, TV Series & Reflections.<br>Discover my analyses and lessons learned.",
        link: "culture/index.html",
        type: "image-bg",
        overlayTitle: "CULTURE G", overlayTitleEn: "GENERAL CULTURE",
        overlayTitleSize: "3rem",
        overlayTitleLetterSpacing: "3px",
        overlayColor: "white",
        overlayBgOpacity: 0.5
    },
    {
        title: "Arduino",
        emoji: "🤖",
        cardLabel: "Arduino", cardLabelEn: "Arduino",
        bg: "assets/arduino_bg.png",
        cardBgOpacity: 0.7,
        desc: "Prototypage électronique & C++.<br>Un projet terminé et plusieurs en développement.",
        descEn: "Electronic prototyping & C++.<br>One completed project and several in development.",
        link: "arduino/index.html",
        type: "image-bg",
        overlayTitle: "LABO ARDUINO", overlayTitleEn: "ARDUINO LAB",
        overlayTitleSize: "3rem",
        overlayTitleLetterSpacing: "2px",
        overlayColor: "white",
        overlayTitleShadow: "0 0 10px #00979d",
        overlayEmojiShadow: "0 4px 15px rgba(0,255,255,0.6)",
        overlayBgOpacity: 0.5
    },
    {
        title: "Projets IHM", titleEn: "HMI Projects",
        emoji: "🖥️",
        cardLabel: "IHM", cardLabelEn: "HMI",
        bg: "assets/IHMHome.png",
        cardBgOpacity: 0.45,
        cardBgColor: "#080d1a",
        cardGradient: "linear-gradient(135deg, rgba(8,13,26,0.5), rgba(0,168,204,0.1))",
        cardEmojiShadow: "0 2px 10px rgba(0,212,255,0.7)",
        cardLabelColor: "#00d4ff",
        cardLabelShadow: "0 0 12px rgba(0,212,255,0.6)",
        desc: "Travaux sur les Interfaces Homme-Machine, notamment le contrôle complet du robot Roomba via une tablette.",
        descEn: "Work on Human-Machine Interfaces, including full control of the Roomba robot via a tablet.",
        link: "ihm/index.html",
        type: "ihm",
        overlayTitle: "PROJETS IHM", overlayTitleEn: "HMI PROJECTS",
        overlayTitleSize: "3rem",
        overlayTitleLetterSpacing: "2px",
        overlayColor: "#00d4ff",
        overlayTitleShadow: "0 0 20px rgba(0,212,255,0.5)",
        overlayEmojiShadow: "0 4px 15px rgba(0,212,255,0.6)",
        overlayGradient: "linear-gradient(135deg, rgba(8,13,26,0.85), rgba(0,168,204,0.15))",
        overlayBgOpacity: 0.25
    },
    {
        title: "Projet Jeu", titleEn: "Game Project",
        emoji: "🍻",
        cardLabel: "GlouGlou", cardLabelEn: "GlouGlou",
        bg: "assets/jeu_bg.png",
        cardBgOpacity: 0.6,
        cardLabelColor: "white",
        cardLabelShadow: "0 0 10px rgba(0,0,0,1)",
        desc: "Développement d'une application mobile festive.<br>Questions, votes, défis et distribution de gorgées entre amis.",
        descEn: "Development of a festive mobile app.<br>Questions, votes, challenges and drinks between friends.",
        type: "construction",
        overlayTitle: "GLOUGLOU", overlayTitleEn: "GLOUGLOU",
        overlayColor: "#f1c40f",
        overlayBgOpacity: 0.4
    },
    {
        title: "Récompenses", titleEn: "Awards",
        emoji: "🏆",
        cardLabel: "Récompenses", cardLabelEn: "Awards",
        type: "awards"
    },
    {
        title: "Stage", titleEn: "Internship",
        emoji: "🎓",
        cardLabel: "Stage", cardLabelEn: "Internship",
        cardBgColor: "#080c14",
        cardGradient: "linear-gradient(135deg, rgba(8,12,20,0.6), rgba(251,191,36,0.08))",
        cardEmojiShadow: "0 2px 10px rgba(251,191,36,0.7)",
        cardLabelColor: "#fbbf24",
        cardLabelShadow: "0 0 12px rgba(251,191,36,0.5)",
        desc: "26 candidatures, 15 refus, 1 obtenu — la démarche complète de recherche de stage chez Faure Herman.",
        descEn: "26 applications, 15 rejections, 1 offer — the full internship search journey at Faure Herman.",
        link: "stage/index.html",
        type: "stage",
        overlayTitle: "STAGE", overlayTitleEn: "INTERNSHIP",
        overlayColor: "#fbbf24",
        overlayTitleShadow: "0 0 20px rgba(251,191,36,0.5)",
        overlayEmojiShadow: "0 4px 15px rgba(251,191,36,0.6)",
        overlayBgOpacity: 0.18
    },
    {
        title: "Statistiques", titleEn: "Statistics",
        emoji: "📊",
        cardLabel: "Stats", cardLabelEn: "Stats",
        bg: null,
        cardBgColor: "#080c14",
        cardGradient: "linear-gradient(135deg, rgba(8,12,20,0.6), rgba(34,211,238,0.08))",
        cardEmojiShadow: "0 2px 10px rgba(34,211,238,0.7)",
        cardLabelColor: "#22d3ee",
        cardLabelShadow: "0 0 12px rgba(34,211,238,0.5)",
        desc: "Visites, chaînes les plus ouvertes, préférences, sessions de blackjack — toutes les données en temps réel.",
        descEn: "Visits, most opened channels, preferences, blackjack sessions — all data in real time.",
        link: "stats/index.html",
        type: "stats",
        overlayTitle: "STATISTIQUES", overlayTitleEn: "STATISTICS",
        overlayTitleSize: "3rem",
        overlayTitleLetterSpacing: "3px",
        overlayColor: "#22d3ee",
        overlayTitleShadow: "0 0 20px rgba(34,211,238,0.5)",
        overlayEmojiShadow: "0 4px 15px rgba(34,211,238,0.6)",
        overlayBgOpacity: 0.15
    },
    {
        title: "Météo", titleEn: "Weather",
        emoji: "🌤️",
        cardLabel: "Météo", cardLabelEn: "Weather",
        type: "meteo"
    }
];

// Calcule les pages selon le viewport
// Mobile (≤768px) : 8 chaînes par page (grille 2×4)
// Desktop         : 12 chaînes par page (grille 4×3)
function computeActivePAGES() {
    const perPage = window.innerWidth <= 768 ? 8 : 12;
    const result  = [];
    for (let i = 0; i < CHANNELS.length; i += perPage) {
        result.push(CHANNELS.slice(i, i + perPage));
    }
    result.push([]); // page vide supplémentaire
    return result;
}

let activePAGES = computeActivePAGES();
let currentPage = 0;

// Nombre de slots par page selon le viewport
function getSlotsPerPage() {
    return window.innerWidth <= 768 ? 8 : 12;
}

/* =========================================
   2. SÉLECTION DES ÉLÉMENTS DU DOM & AUDIO
   ========================================= */
const introScreen  = document.getElementById('intro-screen');
const gridWrapper  = document.getElementById('grid-wrapper');
const bgMusic      = document.getElementById('bg-music');

const overlay = document.getElementById('full-overlay');
const overlayContentBox = document.querySelector('.overlay-content');
const startBtn = document.getElementById('start-btn-action');
const mainFooter = document.getElementById('main-footer');

let activeCard = null;

// Désactive le zoom hover sur mobile (touch)
if ('ontouchstart' in window) {
    document.documentElement.style.setProperty('--hover-scale', '1');
}

const sfxClick1 = new Audio('assets/wiiClickChanel1.mp3');
const sfxClick2 = new Audio('assets/wiiClickChanel2.mp3');
const sfxStart  = new Audio('assets/wiiButtonPopUp.mp3');
const sfxBack   = new Audio('assets/wiibackmenu.mp3');

sfxClick1.volume = 0.6;
sfxClick2.volume = 0.5;
sfxStart.volume  = 0.7;
sfxBack.volume   = 0.7;
sfxClick2.loop   = false;

/* =========================================
   3. GESTION DU SON
   ========================================= */
let soundTimeout = null;

function playChannelSequence() {
    sfxClick1.currentTime = 0;
    sfxClick1.play().catch(e => console.warn("Audio bloqué:", e));
    if (soundTimeout) clearTimeout(soundTimeout);
    soundTimeout = setTimeout(() => {
        if (overlay.style.display === 'flex') {
            sfxClick2.currentTime = 0;
            sfxClick2.play().catch(e => console.warn("Audio 2 bloqué:", e));
        }
    }, 50);
}

function stopChannelSequence() {
    if (soundTimeout) clearTimeout(soundTimeout);
    sfxClick1.pause(); sfxClick1.currentTime = 0;
    sfxClick2.pause(); sfxClick2.currentTime = 0;
}

function playStartSound() {
    sfxStart.currentTime = 0;
    sfxStart.play().catch(e => console.warn("Audio Start bloqué:", e));
}

/* =========================================
   4. GÉNÉRATION DE LA GRILLE
   ========================================= */
function createChannelEl(data, index) {
    const div = document.createElement('div');
    div.className = 'channel';
    div._channelData = data;
    div.onclick = () => zoomChannel(div);

    if (data.type === 'moi') {
        div.innerHTML = `
            <div class="channel-inner moi-card-inner">
                <img src="assets/maphoto.png" class="ch-bg" style="opacity:0.55;">
                <div class="ch-gradient" style="background:linear-gradient(to top, rgba(10,10,30,0.85) 0%, rgba(10,10,30,0.2) 60%, transparent 100%)"></div>
                <div class="moi-card-info">
                    <div class="moi-card-name">Alix Corbin</div>
                    <div class="moi-card-tag">👨‍💻 Développeur</div>
                </div>
            </div>`;
        return div;
    }

    if (data.type === 'blackjack') {
        const img = document.createElement('img');
        img.src = data.bg;
        img.alt = data.title;
        img.className = 'ch-fullimg';
        div.appendChild(img);
        return div;
    }

    if (data.type === 'tictactoe') {
        div.innerHTML = `
            <div class="channel-inner">
                <img src="assets/tictactoe.png" class="ch-fullimg" alt="Morpion">
            </div>`;
        return div;
    }

    if (data.type === 'awards') {
        const label = (currentLang === 'en' && data.cardLabelEn) ? data.cardLabelEn : data.cardLabel;
        const sub   = currentLang === 'en' ? '3 prizes' : '3 prix';
        div.innerHTML = `
            <div class="channel-inner awards-card-inner">
                <img src="assets/recompense.png" class="ch-bg awards-card-bg" alt="">
                <div class="awards-card-overlay"></div>
                <div class="awards-trophy">🏆</div>
                <h2 class="ch-label awards-card-label">${label}</h2>
                <div class="awards-count">${sub}</div>
            </div>`;
        return div;
    }

    if (data.type === 'meteo') {
        const label = (currentLang === 'en' && data.cardLabelEn) ? data.cardLabelEn : data.cardLabel;
        div.innerHTML = `
            <div class="channel-inner meteo-card-inner">
                <img src="assets/meteo.png" class="ch-bg meteo-card-bg" alt="">
                <div class="meteo-card-overlay"></div>
                <div class="meteo-card-icon">🌤️</div>
                <h2 class="ch-label meteo-card-label">${label}</h2>
                <div class="meteo-card-sub" id="meteo-card-sub">--°C</div>
            </div>`;
        return div;
    }

    if (data.type === 'stats') {
        const label = (currentLang === 'en' && data.cardLabelEn) ? data.cardLabelEn : data.cardLabel;
        div.innerHTML = `
            <div class="channel-inner stats-card-inner" style="background:#080c14">
                <img src="assets/stats_bg.png" class="ch-bg" style="opacity:0.25;object-fit:cover;">
                <div class="ch-gradient" style="background:linear-gradient(135deg,rgba(8,12,20,0.5),rgba(34,211,238,0.08))"></div>
                <span class="ch-emoji" style="text-shadow:0 2px 10px rgba(34,211,238,0.7)">📊</span>
                <h2 class="ch-label" style="color:#22d3ee;text-shadow:0 0 12px rgba(34,211,238,0.5)">${label}</h2>
                <div class="stats-card-bars">
                    <div class="stats-bar" style="height:60%"></div>
                    <div class="stats-bar" style="height:35%"></div>
                    <div class="stats-bar" style="height:80%"></div>
                    <div class="stats-bar" style="height:50%"></div>
                    <div class="stats-bar" style="height:95%"></div>
                    <div class="stats-bar" style="height:40%"></div>
                    <div class="stats-bar" style="height:70%"></div>
                </div>
            </div>`;
        return div;
    }

    if (data.type === 'profil') {
        const label = (currentLang === 'en' && data.cardLabelEn) ? data.cardLabelEn : data.cardLabel;
        div.innerHTML = `
            <div class="channel-inner" style="background:#0d0f1a">
                <div class="ch-gradient" style="background:linear-gradient(135deg,rgba(13,15,26,0.4),rgba(108,92,231,0.18))"></div>
                <span class="ch-emoji" style="text-shadow:0 2px 10px rgba(108,92,231,0.8)">💼</span>
                <h2 class="ch-label" style="color:#a78bfa;text-shadow:0 0 12px rgba(108,92,231,0.6)">${label}</h2>
                <div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:4px;white-space:nowrap">
                    <span style="font-size:0.6rem;font-weight:700;padding:2px 7px;border-radius:8px;background:rgba(108,92,231,0.18);color:#a78bfa">S4</span>
                    <span style="font-size:0.6rem;font-weight:700;padding:2px 7px;border-radius:8px;background:rgba(74,192,224,0.15);color:#4ac0e0">Full-Stack</span>
                </div>
            </div>`;
        return div;
    }

    if (data.type === 'stage') {
        const label = (currentLang === 'en' && data.cardLabelEn) ? data.cardLabelEn : data.cardLabel;
        div.innerHTML = `
            <div class="channel-inner" style="background:#080c14">
                <img src="assets/stage_bg.png" class="ch-bg" style="opacity:0.22;object-fit:cover;">
                <div class="ch-gradient" style="background:linear-gradient(135deg,rgba(8,12,20,0.55),rgba(251,191,36,0.08))"></div>
                <span class="ch-emoji" style="text-shadow:0 2px 10px rgba(251,191,36,0.7)">🎓</span>
                <h2 class="ch-label" style="color:#fbbf24;text-shadow:0 0 12px rgba(251,191,36,0.5)">${label}</h2>
                <div class="stage-card-pills">
                    <span class="scp refused">15 ✕</span>
                    <span class="scp pending">10 ○</span>
                    <span class="scp accepted">1 ✓</span>
                </div>
            </div>`;
        return div;
    }

    const inner = document.createElement('div');
    inner.className = 'channel-inner';
    if (data.cardBgColor) inner.style.background = data.cardBgColor;

    if (data.bg) {
        const img = document.createElement('img');
        img.src = data.bg;
        img.alt = data.title;
        img.className = 'ch-bg';
        img.style.opacity = data.cardBgOpacity ?? 0.7;
        inner.appendChild(img);
    }

    if (data.cardGradient) {
        const grad = document.createElement('div');
        grad.className = 'ch-gradient';
        grad.style.background = data.cardGradient;
        inner.appendChild(grad);
    }

    if (data.emoji) {
        const em = document.createElement('span');
        em.className = 'ch-emoji';
        em.textContent = data.emoji;
        if (data.cardEmojiShadow) em.style.textShadow = data.cardEmojiShadow;
        inner.appendChild(em);
    }

    const label = document.createElement('h2');
    label.className = 'ch-label';
    const labelText = (currentLang === 'en' && data.cardLabelEn) ? data.cardLabelEn : (data.cardLabel || data.title);
    label.textContent = labelText;
    if (data.cardLabelColor) {
        label.style.color = data.cardLabelColor;
        label.style.textShadow = data.cardLabelShadow || '';
    }
    inner.appendChild(label);

    div.appendChild(inner);
    return div;
}

function renderGrid() {
    const track = document.getElementById('grid-track');
    track.innerHTML = '';

    const slots = getSlotsPerPage();
    activePAGES.forEach((pageChannels, pageIndex) => {
        const pageEl = document.createElement('div');
        pageEl.className = 'grid-page';
        pageEl.id = `grid-page-${pageIndex}`;

        pageChannels.forEach((ch, i) => pageEl.appendChild(createChannelEl(ch, i)));
        const empties = slots - pageChannels.length;
        for (let i = 0; i < empties; i++) {
            const div = document.createElement('div');
            div.className = 'channel empty';
            pageEl.appendChild(div);
        }
        track.appendChild(pageEl);
    });

    updatePageArrows();
    updateActivePageStyle();
    requestAnimationFrame(() => applyCarouselOffset(false));
}

function applyCarouselOffset(animated = true) {
    const track  = document.getElementById('grid-track');
    const pageEl = document.getElementById(`grid-page-${currentPage}`);
    if (!track || !pageEl) return;

    track.style.transition = animated
        ? 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)'
        : 'none';

    const matrix   = new DOMMatrix(getComputedStyle(track).transform);
    const currentX = matrix.m41;

    const pageRect     = pageEl.getBoundingClientRect();
    const pageTrueLeft = pageRect.left - currentX;

    const vw      = window.innerWidth;
    const targetX = (vw - pageRect.width) / 2 - pageTrueLeft;

    track.style.transform = `translateX(${targetX}px)`;
}

function updateActivePageStyle() {
    activePAGES.forEach((_, i) => {
        const pageEl = document.getElementById(`grid-page-${i}`);
        if (pageEl) pageEl.classList.toggle('page-inactive', i !== currentPage);
    });
}

function updatePageArrows() {
    const leftArrow  = document.getElementById('page-arrow-left');
    const rightArrow = document.getElementById('page-arrow-right');
    if (leftArrow)  { leftArrow.style.opacity  = currentPage > 0 ? '1' : '0';                        leftArrow.style.pointerEvents  = currentPage > 0 ? 'all' : 'none'; }
    if (rightArrow) { rightArrow.style.opacity = currentPage < activePAGES.length - 1 ? '1' : '0';   rightArrow.style.pointerEvents = currentPage < activePAGES.length - 1 ? 'all' : 'none'; }
}

function navigatePage(dir) {
    const newPage = currentPage + dir;
    if (newPage < 0 || newPage >= activePAGES.length) return;
    sfxBack.currentTime = 0;
    sfxBack.play().catch(() => {});
    currentPage = newPage;
    applyCarouselOffset(true);
    updatePageArrows();
    updateActivePageStyle();
}

let lastIsMobile = window.innerWidth <= 768;
window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile !== lastIsMobile) {
        lastIsMobile   = isMobile;
        activePAGES    = computeActivePAGES();
        currentPage    = 0;
        renderGrid();
    } else {
        applyCarouselOffset(false);
    }
});

/* =========================================
   5. GESTION DE L'INTRODUCTION
   ========================================= */
function startExperience() {
    if (bgMusic) {
        bgMusic.volume = 0.5;
        bgMusic.play().catch(e => console.warn("Lecture auto bloquée :", e));
    }
    if (introScreen) {
        introScreen.style.opacity = '0';
        setTimeout(() => {
            introScreen.style.display = 'none';
            if (gridWrapper) gridWrapper.classList.add('grid-visible');
        }, 500);
    }
}

/* =========================================
   6. CONTENU DE L'OVERLAY
   ========================================= */
function renderOverlayContent(data) {
    overlayContentBox.style.padding = '';
    overlayContentBox.style.overflow = '';
    overlayContentBox.style.justifyContent = 'center';
    overlayContentBox.style.alignItems = 'center';
    overlayContentBox.style.display = 'flex';
    overlayContentBox.style.flexDirection = 'column';
    overlayContentBox.style.color = '';
    overlay.style.background = '';

    const isEn = currentLang === 'en';

    if (startBtn) {
        startBtn.style.display = 'flex';
        startBtn.classList.remove('btn-disabled');
        startBtn.innerText = data.type === 'moi' ? t('overlay.cv') : t('overlay.start');
        startBtn.onclick = data.link
            ? () => {
                playStartSound();
                if (data.type === 'moi') {
                    window.open(data.link, '_blank');
                } else {
                    // Fondu au noir pour laisser le son se jouer
                    fadeAndNavigate(data.link);
                }
            }
            : null;
    }

    switch (data.type) {
        case 'moi':
            overlay.style.background = "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)";
            overlayContentBox.innerHTML = `
                <div class="moi-layout">
                    <div class="moi-left">
                        <div class="moi-avatar-ring">
                            <img src="assets/maphoto.png" class="moi-avatar" alt="Alix Corbin">
                        </div>
                        <div class="moi-name">Alix Corbin</div>
                        <div class="moi-role">${isEn ? 'Developer in training' : 'Développeur en formation'}</div>
                        <div class="moi-location">📍 Mayenne &amp; Sarthe</div>
                        <div class="moi-socials">
                            <a href="https://github.com/AlixCORBIN" target="_blank" rel="noopener" class="moi-social-btn" title="GitHub">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/></svg>
                            </a>
                            <a href="https://www.linkedin.com/in/alix-corbin-6a89983a3/" target="_blank" rel="noopener" class="moi-social-btn" title="LinkedIn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            </a>
                        </div>
                    </div>
                    <div class="moi-right">
                        <div class="moi-card moi-card--highlight">
                            <div class="moi-card-icon">🔍</div>
                            <div class="moi-card-body">
                                <div class="moi-card-title">${isEn ? 'Looking for' : 'Je cherche'}</div>
                                <div class="moi-card-value">${isEn ? 'An <strong>apprenticeship</strong> for <strong>2026–2027</strong>' : 'Une <strong>alternance</strong> pour <strong>2026–2027</strong>'}</div>
                            </div>
                        </div>
                        <div class="moi-card">
                            <div class="moi-card-icon">🎓</div>
                            <div class="moi-card-body">
                                <div class="moi-card-title">${isEn ? 'Education' : 'Formation'}</div>
                                <div class="moi-card-value">${isEn ? '2nd year of <strong>CS Bachelor\'s Degree</strong>' : '2e année de <strong>BUT Informatique</strong>'}</div>
                            </div>
                        </div>
                        <div class="moi-card">
                            <div class="moi-card-icon">💻</div>
                            <div class="moi-card-body">
                                <div class="moi-card-title">${isEn ? 'Skills' : 'Compétences'}</div>
                                <div class="moi-skills">
                                    <span class="skill-pill">Java</span>
                                    <span class="skill-pill">Web</span>
                                    <span class="skill-pill">SQL</span>
                                    <span class="skill-pill">Arduino</span>
                                </div>
                            </div>
                        </div>
                        <div class="moi-card">
                            <div class="moi-card-icon">✨</div>
                            <div class="moi-card-body">
                                <div class="moi-card-title">${isEn ? 'Soft skills' : 'Qualités'}</div>
                                <div class="moi-skills">
                                    <span class="skill-pill">${isEn ? 'Analytical' : 'Esprit analytique'}</span>
                                    <span class="skill-pill">${isEn ? 'Eloquent' : 'Éloquent'}</span>
                                    <span class="skill-pill">${isEn ? 'Leadership' : 'Leadership'}</span>
                                    <span class="skill-pill">${isEn ? 'Team player' : 'Sociable'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="moi-cta">${isEn ? 'Press "View my CV" 👇' : 'Appuyez sur "Voir mon CV" 👇'}</div>
                    </div>
                </div>`;
            break;

        case 'blackjack':
            overlay.style.background = "black";
            overlayContentBox.style.padding = '0';
            overlayContentBox.style.overflow = 'hidden';
            overlayContentBox.innerHTML = `<img src="${data.bg}" style="width:100%;height:100%;object-fit:contain;">`;
            break;

        case 'tictactoe':
            overlay.style.background = "black";
            overlayContentBox.style.padding = '0';
            overlayContentBox.style.overflow = 'hidden';
            overlayContentBox.innerHTML = `
                <div class="overlay-image-bg">
                    <img class="overlay-bg-img" src="assets/tictactoe.png" style="opacity:0.35;object-fit:cover;">
                    <div class="overlay-gradient" style="background:linear-gradient(135deg,rgba(10,10,30,0.7),rgba(0,80,120,0.4))"></div>
                    <div class="overlay-text-block">
                        <div class="ov-emoji" style="text-shadow:0 0 20px #4ac0e0">⭕❌</div>
                        <h1 class="ov-title" style="color:#4ac0e0;text-shadow:0 0 15px rgba(74,192,224,0.6)">${isEn ? 'TIC-TAC-TOE' : 'MORPION'}</h1>
                        <p class="ov-desc">${isEn ? 'A Java classic.<br>Play against a friend locally.' : 'Un classique en Java.<br>Jouez contre un ami en local.'}</p>
                    </div>
                </div>`;
            break;

        case 'image-bg':
        case 'ihm': {
            overlay.style.background = "black";
            overlayContentBox.style.padding = '0';
            overlayContentBox.style.overflow = 'hidden';
            const gradHtml = data.overlayGradient
                ? `<div class="overlay-gradient" style="background:${data.overlayGradient}"></div>`
                : '';
            const title = (isEn && data.overlayTitleEn) ? data.overlayTitleEn : data.overlayTitle;
            const desc  = (isEn && data.descEn) ? data.descEn : (data.desc || '');
            overlayContentBox.innerHTML = `
                <div class="overlay-image-bg">
                    <img class="overlay-bg-img" src="${data.bg}" style="opacity:${data.overlayBgOpacity ?? 0.5}">
                    ${gradHtml}
                    <div class="overlay-text-block">
                        <div class="ov-emoji" style="text-shadow:${data.overlayEmojiShadow || '0 4px 15px rgba(0,0,0,0.8)'}">${data.emoji}</div>
                        <h1 class="ov-title" style="font-size:${data.overlayTitleSize || '3rem'};letter-spacing:${data.overlayTitleLetterSpacing || '2px'};color:${data.overlayColor};${data.overlayTitleShadow ? `text-shadow:${data.overlayTitleShadow}` : ''}">${title}</h1>
                        <p class="ov-desc">${desc}</p>
                    </div>
                </div>`;
            break;
        }

        case 'construction': {
            overlay.style.background = "black";
            overlayContentBox.style.padding = '0';
            overlayContentBox.style.overflow = 'hidden';
            if (startBtn) {
                startBtn.classList.add('btn-disabled');
                startBtn.innerText = t('overlay.soon');
                startBtn.onclick = null;
            }
            const desc = (isEn && data.descEn) ? data.descEn : (data.desc || '');
            const title = (isEn && data.overlayTitleEn) ? data.overlayTitleEn : data.overlayTitle;
            overlayContentBox.innerHTML = `
                <div class="overlay-image-bg">
                    <img class="overlay-bg-img" src="${data.bg}" style="opacity:${data.overlayBgOpacity ?? 0.4}">
                    <div class="tape-cross tape-1" style="opacity:0.8;">${isEn ? 'IN DEVELOPMENT' : 'EN DÉVELOPPEMENT'}</div>
                    <div class="tape-cross tape-2" style="opacity:0.8;">${isEn ? 'ONGOING PROJECT' : 'PROJET EN COURS'}</div>
                    <div class="overlay-text-block">
                        <div class="ov-emoji">${data.emoji}</div>
                        <h1 class="ov-title" style="color:${data.overlayColor}">${title}</h1>
                        <p class="ov-desc">${desc}</p>
                    </div>
                </div>`;
            break;
        }

        case 'awards': {
            overlay.style.background = "#06070f";
            overlayContentBox.style.padding = '0';
            overlayContentBox.style.overflow = 'hidden';
            if (startBtn) startBtn.style.display = 'none';
            overlayContentBox.innerHTML = `
                <div class="awards-page">

                    <div class="awards-hero-header">
                        <div class="awards-hero-trophy-wrap">🏆</div>
                        <h1 class="awards-hero-title">${isEn ? 'AWARDS' : 'RÉCOMPENSES'}</h1>
                        <p class="awards-hero-sub">${isEn ? 'Contests & Distinctions' : 'Concours & Distinctions'}</p>
                        <div class="awards-divider"></div>
                    </div>

                    <a href="https://www.univ-lemans.fr/fr/actualites/en-2026/ceremonie-des-walid.html"
                       target="_blank" rel="noopener" class="award-hero-card">
                        <img src="https://iut-laval.univ-lemans.fr/_resource/08-Actualit%C3%A9s/2026/F%C3%A9vrier/mmi%20sa%C3%A9/Meilleur%20Portfolio.png"
                             class="award-hero-bg" alt="">
                        <div class="award-hero-bg-fade"></div>
                        <div class="award-hero-bar"></div>
                        <div class="award-hero-content">
                            <div class="award-hero-year-ghost">2026</div>
                            <div class="award-hero-left">
                                <span class="award-rank-pill pill-gold">🥇 ${isEn ? '1st Prize' : '1er Prix'}</span>
                                <h2 class="award-hero-name">${isEn ? 'Best Portfolio Award' : 'Prix du Meilleur Portfolio'}</h2>
                                <p class="award-hero-event">${isEn ? 'Walides Ceremony — Université du Mans' : 'Cérémonie des Walides — Université du Mans'}</p>
                                <span class="award-self-tag">✨ ${isEn ? 'This very portfolio!' : 'Ce portfolio lui-même\u00a0!'}</span>
                            </div>
                            <span class="award-hero-arrow">→</span>
                        </div>
                    </a>

                    <div class="awards-bottom-row">

                        <a href="https://www.stjoseph-lasalle.fr/concours-deloquence-2023/"
                           target="_blank" rel="noopener" class="award-small-card">
                            <div class="award-small-bar bar-silver"></div>
                            <img src="assets/eloquence.jpg" class="award-small-img" alt="">
                            <div class="award-small-fade"></div>
                            <div class="award-small-content">
                                <div class="award-small-year">2023</div>
                                <span class="award-rank-pill pill-silver">🥇 ${isEn ? '1st Place' : '1er Prix'}</span>
                                <div class="award-small-name">${isEn ? 'Public Speaking Contest' : "Concours d'Éloquence"}</div>
                                <div class="award-small-event">${isEn ? 'St Joseph La Salle High School' : 'Lycée St Joseph La Salle'}</div>
                            </div>
                        </a>

                        <div class="award-small-card award-no-link">
                            <div class="award-small-bar bar-bronze"></div>
                            <img src="assets/Castor.png" class="award-small-img" alt="">
                            <div class="award-small-fade"></div>
                            <div class="award-small-content">
                                <div class="award-small-year">2021</div>
                                <span class="award-rank-pill pill-bronze">🏅 Top 0,14%</span>
                                <div class="award-small-name">${isEn ? 'Castor Contest' : 'Concours Castor'}</div>
                                <div class="award-small-stat">${isEn ? '64th / 45,281 students' : '64ème / 45\u202f281 participants'}</div>
                                <div class="award-small-event">${isEn ? 'Informatics Competition' : 'Concours Informatique'}</div>
                            </div>
                        </div>

                    </div>
                </div>`;
            break;
        }

        case 'stats': {
            overlay.style.background = "linear-gradient(135deg, #080c14 0%, #0e1420 100%)";
            overlayContentBox.style.padding = '0';
            overlayContentBox.style.overflow = 'hidden';
            const statsDesc = isEn ? data.descEn : data.desc;
            overlayContentBox.innerHTML = `
                <div class="overlay-image-bg">
                    <img class="overlay-bg-img" src="assets/stats_bg.png" style="opacity:0.2;object-fit:cover;">
                    <div class="overlay-gradient" style="background:linear-gradient(135deg,rgba(8,12,20,0.75),rgba(34,211,238,0.05))"></div>
                    <div class="overlay-text-block">
                        <div class="ov-emoji" style="text-shadow:0 0 30px rgba(34,211,238,0.8)">📊</div>
                        <h1 class="ov-title" style="font-size:3rem;letter-spacing:3px;color:#22d3ee;text-shadow:0 0 20px rgba(34,211,238,0.5)">${isEn ? 'STATISTICS' : 'STATISTIQUES'}</h1>
                        <p class="ov-desc">${statsDesc}</p>
                        <div class="stats-preview-bars">
                            <div class="spb" style="height:60%"></div>
                            <div class="spb" style="height:35%"></div>
                            <div class="spb" style="height:80%"></div>
                            <div class="spb" style="height:50%"></div>
                            <div class="spb" style="height:95%"></div>
                            <div class="spb" style="height:40%"></div>
                            <div class="spb" style="height:70%"></div>
                        </div>
                    </div>
                </div>`;
            break;
        }

        case 'stage': {
            overlay.style.background = "linear-gradient(135deg, #080c14 0%, #0e1420 100%)";
            overlayContentBox.style.padding = '0';
            overlayContentBox.style.overflow = 'hidden';
            const stageDesc = isEn ? data.descEn : data.desc;
            overlayContentBox.innerHTML = `
                <div class="overlay-image-bg">
                    <img class="overlay-bg-img" src="assets/stage_bg.png" style="opacity:0.2;object-fit:cover;">
                    <div class="overlay-gradient" style="background:linear-gradient(135deg,rgba(8,12,20,0.75),rgba(251,191,36,0.05))"></div>
                    <div class="overlay-text-block">
                        <div class="ov-emoji" style="text-shadow:0 0 30px rgba(251,191,36,0.8)">🎓</div>
                        <h1 class="ov-title" style="font-size:3rem;letter-spacing:3px;color:#fbbf24;text-shadow:0 0 20px rgba(251,191,36,0.5)">${isEn ? 'INTERNSHIP' : 'STAGE'}</h1>
                        <p class="ov-desc">${stageDesc}</p>
                        <div style="display:flex;gap:10px;justify-content:center;margin-top:14px">
                            <span style="background:rgba(248,113,113,0.15);border:1px solid rgba(248,113,113,0.3);color:#f87171;padding:4px 12px;border-radius:12px;font-size:0.75rem">15 ${isEn ? 'rejected' : 'refus'}</span>
                            <span style="background:rgba(251,146,60,0.15);border:1px solid rgba(251,146,60,0.3);color:#fb923c;padding:4px 12px;border-radius:12px;font-size:0.75rem">10 ${isEn ? 'pending' : 'en attente'}</span>
                            <span style="background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.3);color:#4ade80;padding:4px 12px;border-radius:12px;font-size:0.75rem">✅ Faure Herman</span>
                        </div>
                    </div>
                </div>`;
            break;
        }

        case 'profil': {
            overlay.style.background = "linear-gradient(135deg, #0d0f1a 0%, #16192e 100%)";
            overlayContentBox.style.padding = '0';
            overlayContentBox.style.overflow = 'hidden';
            const profilDesc = isEn ? data.descEn : data.desc;
            overlayContentBox.innerHTML = `
                <div class="overlay-image-bg">
                    <div class="overlay-gradient" style="background:linear-gradient(135deg,rgba(13,15,26,0.6),rgba(108,92,231,0.12))"></div>
                    <div class="overlay-text-block">
                        <div class="ov-emoji" style="text-shadow:0 0 30px rgba(108,92,231,0.9)">💼</div>
                        <h1 class="ov-title" style="font-size:2.2rem;letter-spacing:2px;color:#a78bfa;text-shadow:0 0 20px rgba(108,92,231,0.6)">${isEn ? 'MY PRO PROFILE' : 'MON PROFIL PRO'}</h1>
                        <p class="ov-desc">${profilDesc}</p>
                        <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap">
                            <span style="background:rgba(108,92,231,0.15);border:1px solid rgba(108,92,231,0.35);color:#a78bfa;padding:4px 12px;border-radius:12px;font-size:0.75rem">💻 Full-Stack</span>
                            <span style="background:rgba(74,192,224,0.12);border:1px solid rgba(74,192,224,0.3);color:#4ac0e0;padding:4px 12px;border-radius:12px;font-size:0.75rem">☕ Java</span>
                            <span style="background:rgba(74,192,224,0.12);border:1px solid rgba(74,192,224,0.3);color:#4ac0e0;padding:4px 12px;border-radius:12px;font-size:0.75rem">🌐 Web</span>
                            <span style="background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);color:#4ade80;padding:4px 12px;border-radius:12px;font-size:0.75rem">🤖 IoT</span>
                        </div>
                    </div>
                </div>`;
            break;
        }

        case 'meteo': {
            overlay.style.background = `url('assets/meteo.png') center/cover no-repeat`;
            if (startBtn) startBtn.style.display = 'none';

            if (weatherCache) {
                renderWeatherOverlay(weatherCache, isEn);
            } else {
                overlayContentBox.innerHTML = `<div class="meteo-loading">${isEn ? 'Locating...' : 'Localisation...'} 📡</div>`;
            }
            break;
        }

        default:
            overlay.style.background = "white";
            overlayContentBox.innerHTML = `
                <div class="start-icon">${data.emoji || ''}</div>
                <div class="start-title">${isEn ? (data.titleEn || data.title) : data.title}</div>
                <div class="start-subtitle">${isEn ? 'Start this channel?' : 'Démarrer cette chaîne\u00a0?'}</div>`;
    }
}

/* =========================================
   7. ANIMATION & NAVIGATION
   ========================================= */
function zoomChannel(element) {
    if (element.classList.contains('empty')) return;
    playChannelSequence();
    activeCard = element;
    renderOverlayContent(element._channelData);
    // Tracking clics chaînes
    const chName = element._channelData.title || 'unknown';
    sbPost('increment_channel_click', { p_channel: chName });

    const rect = element.getBoundingClientRect();
    overlay.style.display = 'flex';
    overlay.style.transition = 'none';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.borderRadius = '20px';

    if (mainFooter) mainFooter.classList.add('footer-hidden');
    overlay.offsetHeight;

    overlay.style.transition = 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    overlay.style.top = '0px';
    overlay.style.left = '0px';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.borderRadius = '0px';

    element.classList.add('hidden');
    setTimeout(() => { overlay.classList.add('active'); }, 50);
}

function closeZoom() {
    if (!activeCard) return;
    sfxBack.currentTime = 0;
    sfxBack.play().catch(e => console.warn("Audio Back bloqué:", e));
    stopChannelSequence();

    overlay.classList.remove('active');
    const rect = activeCard.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.borderRadius = '20px';

    if (mainFooter) mainFooter.classList.remove('footer-hidden');
    setTimeout(() => {
        overlay.style.display = 'none';
        activeCard.classList.remove('hidden');
        activeCard = null;
    }, 600);
}

function navigate(direction) {
    const channelEls = Array.from(document.querySelectorAll('.channel:not(.empty)'));
    if (channelEls.length < 2) return;
    stopChannelSequence();
    playChannelSequence();
    const currentIndex = channelEls.indexOf(activeCard);
    const newIndex = (currentIndex + direction + channelEls.length) % channelEls.length;
    const nextCard = channelEls[newIndex];
    activeCard.classList.remove('hidden');
    nextCard.classList.add('hidden');
    activeCard = nextCard;
    renderOverlayContent(nextCard._channelData);
}

/* =========================================
   8. MUSIQUE
   ========================================= */
let musicMuted = false;

function toggleMusic() {
    musicMuted = !musicMuted;
    const btn = document.getElementById('music-btn');
    const iconOn = document.getElementById('music-icon');
    const iconOff = document.getElementById('music-icon-muted');

    if (musicMuted) {
        bgMusic.pause();
        iconOn.style.display = 'none';
        iconOff.style.display = 'block';
        btn.classList.add('music-muted');
    } else {
        bgMusic.play().catch(() => {});
        iconOn.style.display = 'block';
        iconOff.style.display = 'none';
        btn.classList.remove('music-muted');
    }
    sbPost('increment_preference', { p_event: musicMuted ? 'music_muted' : 'music_unmuted' });
}

/* =========================================
   9. DARK MODE
   ========================================= */
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? '1' : '0');
    sfxBack.currentTime = 0;
    sfxBack.play().catch(() => {});
    sbPost('increment_preference', { p_event: isDark ? 'dark_mode_on' : 'dark_mode_off' });
}

if (localStorage.getItem('darkMode') === '1') {
    document.body.classList.add('dark-mode');
}

/* =========================================
   10. MODAL CONTACT
   ========================================= */
function openContact() {
    const modal = document.getElementById('contact-modal');
    if (modal) {
        modal.classList.add('contact-visible');
        sfxStart.currentTime = 0;
        sfxStart.play().catch(() => {});
    }
}

function closeContact() {
    const modal = document.getElementById('contact-modal');
    if (modal) modal.classList.remove('contact-visible');
}

/* =========================================
   11. HORLOGE
   ========================================= */
function updateClock() {
    const now = new Date();
    const hEl = document.getElementById('h');
    const mEl = document.getElementById('m');
    const ampmEl = document.getElementById('ampm');
    const dateEl = document.getElementById('date');

    if (hEl) hEl.innerText = now.getHours();
    if (mEl) mEl.innerText = String(now.getMinutes()).padStart(2, '0');
    if (ampmEl) ampmEl.innerText = '';
    if (dateEl) {
        const daysFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = currentLang === 'en' ? daysEn : daysFr;
        dateEl.innerText = `${days[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
    }
}

setInterval(updateClock, 1000);
updateClock();

/* =========================================
   SUPABASE — HELPERS + COMPTEURS
   ========================================= */
const SUPABASE_URL = 'https://njkbhgmwylletmdmsmyl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2JoZ213eWxsZXRtZG1zbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ2MzYsImV4cCI6MjA5MjQ1MDYzNn0.Vp6CfEi3dtUL1Z1h8kYkrCAXBMlBuSogocffaKE_9tw';

function sbPost(rpc, body) {
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpc}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body || {})
    }).catch(() => {});
}

// Compteur total de visites (affiché dans le footer)
sbPost('increment_views')
    .then(r => r && r.json())
    .then(count => {
        const el = document.getElementById('visitor-count');
        if (el && count) el.textContent = '👁 ' + Number(count).toLocaleString('fr-FR') + ' visites';
    })
    .catch(() => {});

// Compteur journalier (pour la page stats)
sbPost('increment_daily_visit').catch(() => {});

/* =========================================
   12. MÉTÉO
   ========================================= */
const WEATHER_API_KEY = 'd9409f721206c46f1b0cda57aa74d801';

const WEATHER_ICONS = {
    Thunderstorm: '⛈️', Drizzle: '🌦️', Rain: '🌧️',
    Snow: '❄️', Mist: '🌫️', Smoke: '🌫️', Haze: '🌫️',
    Dust: '🌫️', Fog: '🌫️', Sand: '🌫️', Ash: '🌫️',
    Squall: '💨', Tornado: '🌪️', Clear: '☀️', Clouds: '☁️'
};

let weatherCache   = null;
let forecastCache  = null;

function buildForecastHTML(forecastData, isEn) {
    if (!forecastData || !forecastData.list) return '';

    const daysFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNames = isEn ? daysEn : daysFr;

    const todayStr = new Date().toISOString().slice(0, 10);
    const byDay = {};

    forecastData.list.forEach(entry => {
        const day = entry.dt_txt.slice(0, 10);
        if (day === todayStr) return;
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(entry);
    });

    const days = Object.keys(byDay).slice(0, 5);
    if (!days.length) return '';

    const items = days.map(day => {
        const entries  = byDay[day];
        const midday   = entries.find(e => e.dt_txt.includes('12:00:00')) || entries[Math.floor(entries.length / 2)];
        const icon     = WEATHER_ICONS[midday.weather[0].main] || '🌡️';
        const tMin     = Math.round(Math.min(...entries.map(e => e.main.temp_min)));
        const tMax     = Math.round(Math.max(...entries.map(e => e.main.temp_max)));
        const dow      = dayNames[new Date(day).getDay()];
        return `
            <div class="meteo-forecast-day">
                <div class="meteo-fc-name">${dow}</div>
                <div class="meteo-fc-icon">${icon}</div>
                <div class="meteo-fc-temps"><span class="meteo-fc-max">${tMax}°</span><span class="meteo-fc-min">${tMin}°</span></div>
            </div>`;
    }).join('');

    return `<div class="meteo-forecast">${items}</div>`;
}

function renderWeatherOverlay(d, isEn) {
    const icon     = WEATHER_ICONS[d.weather[0].main] || '🌡️';
    const temp     = Math.round(d.main.temp);
    const feels    = Math.round(d.main.feels_like);
    const tMin     = Math.round(d.main.temp_min);
    const tMax     = Math.round(d.main.temp_max);
    const humidity = d.main.humidity;
    const wind     = Math.round(d.wind.speed * 3.6);
    const desc     = d.weather[0].description.charAt(0).toUpperCase() + d.weather[0].description.slice(1);
    const city     = d.name;
    const country  = d.sys.country;

    const cardSub = document.getElementById('meteo-card-sub');
    if (cardSub) cardSub.textContent = `${icon} ${temp}°C`;

    overlayContentBox.innerHTML = `
        <div class="meteo-overlay">
            <div class="meteo-header">
                <div class="meteo-icon-big">${icon}</div>
                <div class="meteo-temp-big">${temp}°C</div>
                <div class="meteo-desc">${desc}</div>
                <div class="meteo-city">📍 ${city}, ${country}</div>
            </div>
            <div class="meteo-grid">
                <div class="meteo-stat">
                    <div class="meteo-stat-label">${isEn ? 'Feels like' : 'Ressenti'}</div>
                    <div class="meteo-stat-value">${feels}°C</div>
                </div>
                <div class="meteo-stat">
                    <div class="meteo-stat-label">Min / Max</div>
                    <div class="meteo-stat-value">${tMin}° / ${tMax}°</div>
                </div>
                <div class="meteo-stat">
                    <div class="meteo-stat-label">${isEn ? 'Humidity' : 'Humidité'}</div>
                    <div class="meteo-stat-value">${humidity}%</div>
                </div>
                <div class="meteo-stat">
                    <div class="meteo-stat-label">${isEn ? 'Wind' : 'Vent'}</div>
                    <div class="meteo-stat-value">${wind} km/h</div>
                </div>
            </div>
            ${buildForecastHTML(forecastCache, isEn)}
        </div>`;
}

function prefetchWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const base = `https://api.openweathermap.org/data/2.5`;

        fetch(`${base}/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=fr`)
            .then(r => r.json())
            .then(d => {
                if (!d.main) return;
                weatherCache = d;
                const icon = WEATHER_ICONS[d.weather[0].main] || '🌡️';
                const temp = Math.round(d.main.temp);
                const cardSub = document.getElementById('meteo-card-sub');
                if (cardSub) cardSub.textContent = `${icon} ${temp}°C`;
            })
            .catch(() => {});

        fetch(`${base}/forecast?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=fr`)
            .then(r => r.json())
            .then(d => { if (d.list) forecastCache = d; })
            .catch(() => {});

    }, () => {});
}

/* =========================================
   13. RACCOURCIS CLAVIER
   ========================================= */
document.addEventListener('keydown', e => {
    const inOverlay = !!activeCard;
    const key = e.key;

    if (inOverlay) {
        if (key === 'ArrowLeft'  || key === 'q' || key === 'Q') { e.preventDefault(); navigate(-1); }
        if (key === 'ArrowRight' || key === 'd' || key === 'D') { e.preventDefault(); navigate(1); }
        if (key === 'Escape')                                    { e.preventDefault(); closeZoom(); }
    } else {
        if (key === 'ArrowLeft'  || key === 'q' || key === 'Q') { e.preventDefault(); navigatePage(-1); }
        if (key === 'ArrowRight' || key === 'd' || key === 'D') { e.preventDefault(); navigatePage(1); }
    }
});

/* =========================================
   FONDU AU NOIR — Transition de page
   ========================================= */
const _pageFade = document.createElement('div');
_pageFade.style.cssText = [
    'position:fixed', 'inset:0', 'background:#000',
    'opacity:1', 'pointer-events:none',
    'transition:opacity 0.5s ease',
    'z-index:99999'
].join(';');
document.body.appendChild(_pageFade);

// Fade-in dès que la page est prête
requestAnimationFrame(() => {
    requestAnimationFrame(() => { _pageFade.style.opacity = '0'; });
});

function fadeAndNavigate(url) {
    _pageFade.style.pointerEvents = 'all';
    _pageFade.style.opacity = '1';
    setTimeout(() => { window.location.href = url; }, 580);
}

/* =========================================
   14. INITIALISATION
   ========================================= */
renderGrid();
applyTranslations(currentLang);
prefetchWeather();

