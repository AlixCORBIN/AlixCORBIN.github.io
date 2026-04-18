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
    }
];

// Pages bureau : toutes les chaînes sur une page + 1 page vide
const PAGES_DESKTOP = [ CHANNELS, [] ];

// Calcule les pages selon le viewport
// Mobile (≤768px) : 8 chaînes par page (grille 4×2)
// Desktop         : toutes les chaînes sur page 1, page 2 vide
function computeActivePAGES() {
    if (window.innerWidth <= 768) {
        const perPage = 8;
        const result  = [];
        for (let i = 0; i < CHANNELS.length; i += perPage) {
            result.push(CHANNELS.slice(i, i + perPage));
        }
        result.push([]); // page vide supplémentaire
        return result;
    }
    return PAGES_DESKTOP;
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
                <div class="awards-trophy">🏆</div>
                <h2 class="ch-label awards-card-label">${label}</h2>
                <div class="awards-count">${sub}</div>
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
            ? () => { playStartSound(); data.type === 'moi' ? window.open(data.link, '_blank') : (window.location.href = data.link); }
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
                       target="_self" class="award-hero-card">
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
                           target="_self" class="award-small-card">
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
}

/* =========================================
   9. DARK MODE
   ========================================= */
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? '1' : '0');
    sfxBack.currentTime = 0;
    sfxBack.play().catch(() => {});
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
   12. INITIALISATION
   ========================================= */
renderGrid();
applyTranslations(currentLang);

