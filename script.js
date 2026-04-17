/* =========================================
   1. DONNÉES DES CHAÎNES
   ========================================= */
const CHANNELS = [
    {
        title: "Moi",
        emoji: "👤",
        cardLabel: "Moi",
        link: "https://cvdesignr.com/p/69ac5851a54b9",
        type: "moi"
    },
    {
        title: "BUT Informatique",
        emoji: "🎓",
        cardLabel: "BUT Info",
        bg: "assets/but_bg.png",
        cardBgOpacity: 0.7,
        desc: "Compétences, Projets & Parcours.<br>Découvre le détail de ma formation et mon évolution.",
        link: "BUT/index.html",
        type: "image-bg",
        overlayTitle: "BUT INFORMATIQUE",
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
        cardLabel: "Culture",
        bg: "assets/culture_bg.png",
        cardBgOpacity: 0.6,
        desc: "Cinéma, Séries & Réflexions.<br>Découvre mes analyses et les leçons que j'en tire.",
        link: "culture/index.html",
        type: "image-bg",
        overlayTitle: "CULTURE G",
        overlayTitleSize: "3rem",
        overlayTitleLetterSpacing: "3px",
        overlayColor: "white",
        overlayBgOpacity: 0.5
    },
    {
        title: "Arduino",
        emoji: "🤖",
        cardLabel: "Arduino",
        bg: "assets/arduino_bg.png",
        cardBgOpacity: 0.7,
        desc: "Prototypage électronique & C++.<br>Un projet terminé et plusieurs en développement.",
        link: "arduino/index.html",
        type: "image-bg",
        overlayTitle: "LABO ARDUINO",
        overlayTitleSize: "3rem",
        overlayTitleLetterSpacing: "2px",
        overlayColor: "white",
        overlayTitleShadow: "0 0 10px #00979d",
        overlayEmojiShadow: "0 4px 15px rgba(0,255,255,0.6)",
        overlayBgOpacity: 0.5
    },
    {
        title: "Projets IHM",
        emoji: "🖥️",
        cardLabel: "IHM",
        bg: "assets/IHMHome.png",
        cardBgOpacity: 0.45,
        cardBgColor: "#080d1a",
        cardGradient: "linear-gradient(135deg, rgba(8,13,26,0.5), rgba(0,168,204,0.1))",
        cardEmojiShadow: "0 2px 10px rgba(0,212,255,0.7)",
        cardLabelColor: "#00d4ff",
        cardLabelShadow: "0 0 12px rgba(0,212,255,0.6)",
        desc: "Travaux sur les Interfaces Homme-Machine, notamment le contrôle complet du robot Roomba via une tablette.",
        link: "ihm/index.html",
        type: "ihm",
        overlayTitle: "PROJETS IHM",
        overlayTitleSize: "3rem",
        overlayTitleLetterSpacing: "2px",
        overlayColor: "#00d4ff",
        overlayTitleShadow: "0 0 20px rgba(0,212,255,0.5)",
        overlayEmojiShadow: "0 4px 15px rgba(0,212,255,0.6)",
        overlayGradient: "linear-gradient(135deg, rgba(8,13,26,0.85), rgba(0,168,204,0.15))",
        overlayBgOpacity: 0.25
    },
    {
        title: "Projet Jeu",
        emoji: "🍻",
        cardLabel: "GlouGlou",
        bg: "assets/jeu_bg.png",
        cardBgOpacity: 0.6,
        cardLabelColor: "white",
        cardLabelShadow: "0 0 10px rgba(0,0,0,1)",
        desc: "Développement d'une application mobile festive.<br>Questions, votes, défis et distribution de gorgées entre amis.",
        type: "construction",
        overlayTitle: "GLOUGLOU",
        overlayColor: "#f1c40f",
        overlayBgOpacity: 0.4
    }
];

/* =========================================
   2. SÉLECTION DES ÉLÉMENTS DU DOM & AUDIO
   ========================================= */
const introScreen = document.getElementById('intro-screen');
const mainGrid = document.getElementById('main-grid');
const bgMusic = document.getElementById('bg-music');

const overlay = document.getElementById('full-overlay');
const overlayContentBox = document.querySelector('.overlay-content');
const startBtn = document.getElementById('start-btn-action');
const mainFooter = document.getElementById('main-footer');

let activeCard = null;

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
    div.dataset.index = index;
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
    label.textContent = data.cardLabel || data.title;
    if (data.cardLabelColor) {
        label.style.color = data.cardLabelColor;
        label.style.textShadow = data.cardLabelShadow || '';
    }
    inner.appendChild(label);

    div.appendChild(inner);
    return div;
}

function renderGrid() {
    CHANNELS.forEach((ch, i) => mainGrid.appendChild(createChannelEl(ch, i)));
    const empties = 12 - CHANNELS.length;
    for (let i = 0; i < empties; i++) {
        const div = document.createElement('div');
        div.className = 'channel empty';
        mainGrid.appendChild(div);
    }
}

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
            if (mainGrid) mainGrid.classList.add('grid-visible');
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

    if (startBtn) {
        startBtn.style.display = 'flex';
        startBtn.classList.remove('btn-disabled');
        startBtn.innerText = data.title === 'Moi' ? "Voir mon CV" : "Démarrer";
        startBtn.onclick = data.link
            ? () => { playStartSound(); window.open(data.link, '_blank'); }
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
                        <div class="moi-role">Développeur en formation</div>
                        <div class="moi-location">📍 Mayenne &amp; Sarthe</div>
                    </div>
                    <div class="moi-right">
                        <div class="moi-card moi-card--highlight">
                            <div class="moi-card-icon">🔍</div>
                            <div class="moi-card-body">
                                <div class="moi-card-title">Je cherche</div>
                                <div class="moi-card-value">Une <strong>alternance</strong> pour <strong>2026–2027</strong></div>
                            </div>
                        </div>
                        <div class="moi-card">
                            <div class="moi-card-icon">🎓</div>
                            <div class="moi-card-body">
                                <div class="moi-card-title">Formation</div>
                                <div class="moi-card-value">2e année de <strong>BUT Informatique</strong></div>
                            </div>
                        </div>
                        <div class="moi-card">
                            <div class="moi-card-icon">💻</div>
                            <div class="moi-card-body">
                                <div class="moi-card-title">Compétences</div>
                                <div class="moi-skills">
                                    <span class="skill-pill">Java</span>
                                    <span class="skill-pill">Web</span>
                                    <span class="skill-pill">SQL</span>
                                    <span class="skill-pill">Arduino</span>
                                </div>
                            </div>
                        </div>
                        <div class="moi-cta">Appuyez sur "Voir mon CV" 👇</div>
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
                        <h1 class="ov-title" style="color:#4ac0e0;text-shadow:0 0 15px rgba(74,192,224,0.6)">MORPION</h1>
                        <p class="ov-desc">Un classique en Java.<br>Jouez contre un ami en local.</p>
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
            overlayContentBox.innerHTML = `
                <div class="overlay-image-bg">
                    <img class="overlay-bg-img" src="${data.bg}" style="opacity:${data.overlayBgOpacity ?? 0.5}">
                    ${gradHtml}
                    <div class="overlay-text-block">
                        <div class="ov-emoji" style="text-shadow:${data.overlayEmojiShadow || '0 4px 15px rgba(0,0,0,0.8)'}">${data.emoji}</div>
                        <h1 class="ov-title" style="font-size:${data.overlayTitleSize || '3rem'};letter-spacing:${data.overlayTitleLetterSpacing || '2px'};color:${data.overlayColor};${data.overlayTitleShadow ? `text-shadow:${data.overlayTitleShadow}` : ''}">${data.overlayTitle}</h1>
                        <p class="ov-desc">${data.desc || ''}</p>
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
                startBtn.innerText = "Bientôt...";
                startBtn.onclick = null;
            }
            overlayContentBox.innerHTML = `
                <div class="overlay-image-bg">
                    <img class="overlay-bg-img" src="${data.bg}" style="opacity:${data.overlayBgOpacity ?? 0.4}">
                    <div class="tape-cross tape-1" style="opacity:0.8;">EN DÉVELOPPEMENT</div>
                    <div class="tape-cross tape-2" style="opacity:0.8;">PROJET EN COURS</div>
                    <div class="overlay-text-block">
                        <div class="ov-emoji">${data.emoji}</div>
                        <h1 class="ov-title" style="color:${data.overlayColor}">${data.overlayTitle}</h1>
                        <p class="ov-desc">${data.desc || ''}</p>
                    </div>
                </div>`;
            break;
        }

        default:
            overlay.style.background = "white";
            overlayContentBox.innerHTML = `
                <div class="start-icon">${data.emoji || ''}</div>
                <div class="start-title">${data.title}</div>
                <div class="start-subtitle">Démarrer cette chaîne ?</div>`;
    }
}

/* =========================================
   7. ANIMATION & NAVIGATION
   ========================================= */
function zoomChannel(element) {
    if (element.classList.contains('empty')) return;
    playChannelSequence();
    activeCard = element;
    const data = CHANNELS[parseInt(element.dataset.index)];
    renderOverlayContent(data);

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
    renderOverlayContent(CHANNELS[parseInt(nextCard.dataset.index)]);
}

/* =========================================
   8. DARK MODE
   ========================================= */
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? '1' : '0');
    sfxBack.currentTime = 0;
    sfxBack.play().catch(() => {});
}

// Restaure la préférence au chargement
if (localStorage.getItem('darkMode') === '1') {
    document.body.classList.add('dark-mode');
}

/* =========================================
   9. MODAL CONTACT
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
   9. HORLOGE
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
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        dateEl.innerText = `${days[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
    }
}

setInterval(updateClock, 1000);
updateClock();
renderGrid();
