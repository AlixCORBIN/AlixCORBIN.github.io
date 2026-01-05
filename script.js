/* =========================================
   1. SÉLECTION DES ÉLÉMENTS DU DOM & AUDIO
   ======================================== */
const introScreen = document.getElementById('intro-screen');
const mainGrid = document.getElementById('main-grid');
const bgMusic = document.getElementById('bg-music');

const overlay = document.getElementById('full-overlay');
const overlayContentBox = document.querySelector('.overlay-content');
const startBtn = document.getElementById('start-btn-action');
const mainFooter = document.getElementById('main-footer');

let activeCard = null;

// --- CRÉATION DES OBJETS AUDIO ---
const sfxClick1 = new Audio('assets/wiiClickChanel1.mp3');
const sfxClick2 = new Audio('assets/wiiClickChanel2.mp3');
const sfxStart = new Audio('assets/wiiButtonPopUp.mp3');
const sfxBack = new Audio('assets/WiiBackMenuButton.mp3'); // LE NOUVEAU SON

// Config volume
sfxClick1.volume = 0.6;
sfxClick2.volume = 0.5;
sfxStart.volume = 0.7;
sfxBack.volume = 0.7;

// On désactive la boucle pour le son 2
sfxClick2.loop = false; 

/* =========================================
   2. GESTION DU SON DES CHAÎNES
   ======================================== */
let soundTimeout = null;

function playChannelSequence() {
    // 1. On lance le premier son (Clic/Zoom)
    sfxClick1.currentTime = 0;
    sfxClick1.play().catch(e => console.warn("Audio bloqué:", e));

    // 2. On lance le deuxième son QUASI IMMÉDIATEMENT (chevauchement)
    if (soundTimeout) clearTimeout(soundTimeout);

    soundTimeout = setTimeout(() => {
        // On vérifie que le zoom est toujours actif
        if (overlay.style.display === 'flex') {
            sfxClick2.currentTime = 0;
            sfxClick2.play().catch(e => console.warn("Audio 2 bloqué:", e));
        }
    }, 50); // 50ms pour un enchaînement ultra-rapide
}

function stopChannelSequence() {
    // On coupe les sons de la chaîne
    if (soundTimeout) clearTimeout(soundTimeout);
    
    sfxClick1.pause();
    sfxClick1.currentTime = 0;
    
    sfxClick2.pause();
    sfxClick2.currentTime = 0;
}

function playStartSound() {
    sfxStart.currentTime = 0;
    sfxStart.play().catch(e => console.warn("Audio Start bloqué:", e));
}

/* =========================================
   3. GESTION DE L'INTRODUCTION
   ======================================== */
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
   4. GESTION DU CONTENU DE L'OVERLAY
   ======================================== */
function renderOverlayContent(element) {
    if (!element) return;

    const title = element.dataset.title;
    const icon = element.dataset.icon;
    const link = element.dataset.link;
    const desc = element.dataset.desc || "";

    // --- RESET DES STYLES ---
    overlayContentBox.style.padding = ''; 
    overlayContentBox.style.justifyContent = 'center';
    overlayContentBox.style.alignItems = 'center';
    overlayContentBox.style.overflow = '';
    overlayContentBox.style.display = 'flex';
    overlayContentBox.style.flexDirection = 'column'; 
    overlayContentBox.style.color = ''; 
    overlay.style.background = '';
    
    // --- RESET DU BOUTON DÉMARRER ---
    if(startBtn) {
        startBtn.style.display = 'flex'; 
        startBtn.classList.remove('btn-disabled');
        startBtn.innerText = (title === 'Moi') ? "Voir mon CV" : "Démarrer";
        
        // Clic avec Son PopUp
        startBtn.onclick = () => {
            if (link) {
                playStartSound(); 
                window.open(link, '_blank');
            }
        };
    }

    // --- LOGIQUE D'AFFICHAGE (CONTENU) ---

    if (title === 'Moi') {
        overlay.style.background = "linear-gradient(to bottom, #fff8f0 0%, #ffeecf 100%)";
        overlayContentBox.innerHTML = `
            <div class="tobias-layout">
                <img src="assets/maphoto.png" class="tobias-avatar" alt="Alix Corbin">
                <div class="tobias-intro">Salut ! Je m'appelle <span class="name-highlight">Alix Corbin</span>, étudiant à Laval.</div>
                <div class="tobias-sub">Actuellement en <span class="blue-highlight">2e année de BUT Info</span>.</div>
                <div class="tobias-desc">Compétent en <span class="blue-highlight">Java, Web & SQL</span>.<br><br>Je recherche un stage de <span class="name-highlight">8 à 12 semaines</span> à partir du <span class="name-highlight">13 Avril 2026</span>.</div>
                <div class="tobias-cta">Appuyez sur "Voir mon CV".</div>
            </div>`;

    } else if (title === 'Blackjack') {
        overlay.style.background = "black";
        overlayContentBox.style.padding = '0';
        overlayContentBox.style.overflow = 'hidden';
        overlayContentBox.innerHTML = icon;
        const img = overlayContentBox.querySelector('img');
        if (img) { img.style.width = "100%"; img.style.height = "100%"; img.style.objectFit = "contain"; }

    } else if (title === 'Culture') {
        overlay.style.background = "black";
        overlayContentBox.style.padding = '0';
        overlayContentBox.style.overflow = 'hidden';
        overlayContentBox.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                <img src="${icon}" style="position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: cover; opacity: 0.5;">
                <div style="position: relative; z-index: 10; color: white; padding: 20px; max-width: 80%;">
                    <div style="font-size: 5rem; margin-bottom: 20px; text-shadow: 0 4px 15px rgba(0,0,0,0.8);">🎬</div>
                    <h1 style="font-size: 3rem; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 4px 10px rgba(0,0,0,1);">CULTURE G</h1>
                    <p style="font-size: 1.5rem; line-height: 1.5; font-weight: 300; text-shadow: 0 2px 5px rgba(0,0,0,1); color: #ddd;">${desc}</p>
                </div>
            </div>`;

    } else if (title === 'BUT Informatique') {
        overlay.style.background = "black";
        overlayContentBox.style.padding = '0';
        overlayContentBox.style.overflow = 'hidden';
        overlayContentBox.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                <img src="${icon}" style="position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: cover; opacity: 0.4;">
                <div style="position: relative; z-index: 10; color: white; padding: 20px; max-width: 80%;">
                    <div style="font-size: 5rem; margin-bottom: 20px; text-shadow: 0 4px 15px rgba(0,0,0,0.8);">🎓</div>
                    <h1 style="font-size: 2.5rem; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 4px 10px rgba(0,0,0,1); color: #4ac0e0;">BUT INFORMATIQUE</h1>
                    <p style="font-size: 1.4rem; line-height: 1.5; font-weight: 300; text-shadow: 0 2px 5px rgba(0,0,0,1); color: #eee;">${desc}</p>
                </div>
            </div>`;

    } else if (title === 'Arduino') {
        overlay.style.background = "black";
        overlayContentBox.style.padding = '0';
        overlayContentBox.style.overflow = 'hidden';
        overlayContentBox.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                <img src="${icon}" style="position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: cover; opacity: 0.5;">
                <div style="position: relative; z-index: 10; color: white; padding: 20px; max-width: 80%;">
                    <div style="font-size: 5rem; margin-bottom: 20px; text-shadow: 0 4px 15px rgba(0,255,255,0.6);">🤖</div>
                    <h1 style="font-size: 3rem; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px #00979d;">LABO ARDUINO</h1>
                    <p style="font-size: 1.4rem; line-height: 1.5; font-weight: 300; text-shadow: 0 2px 5px rgba(0,0,0,1); color: #e0f7fa;">${desc}</p>
                </div>
            </div>`;

    } else if (title === 'Projet Jeu') {
        // JEU ALCOOL (En travaux)
        overlay.style.background = "black";
        overlayContentBox.style.padding = '0';
        overlayContentBox.style.overflow = 'hidden';

        if(startBtn) {
            startBtn.classList.add('btn-disabled');
            startBtn.innerText = "Bientôt...";
            startBtn.onclick = null; 
        }

        overlayContentBox.innerHTML = `
            <div class="construction-container" style="background: none;">
                <img src="${icon}" style="position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: cover; opacity: 0.4;">
                <div class="tape-cross tape-1" style="opacity: 0.8;">EN DÉVELOPPEMENT</div>
                <div class="tape-cross tape-2" style="opacity: 0.8;">PROJET EN COURS</div>
                <div style="position: relative; z-index: 10; color: white; padding: 20px; max-width: 80%; text-align: center; text-shadow: 0 2px 10px rgba(0,0,0,1);">
                    <div style="font-size: 5rem; margin-bottom: 20px;">🍻</div>
                    <h1 style="font-size: 3rem; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; color: #f1c40f;">GLOUGLOU</h1>
                    <p style="font-size: 1.5rem; line-height: 1.5; font-weight: 300; color: #eee;">${desc}</p>
                </div>
            </div>`;

    } else if (title === 'Projets IHM') {
        overlay.style.background = "repeating-linear-gradient(45deg, #ffc107, #ffc107 20px, #ffca2c 20px, #ffca2c 40px)";
        if(startBtn) { 
            startBtn.classList.add('btn-disabled'); 
            startBtn.innerText = "En Travaux"; 
            startBtn.onclick = null; 
        }
        overlayContentBox.innerHTML = `
            <div class="construction-container">
                <div class="tape-cross tape-1">EN TRAVAUX</div>
                <div class="tape-cross tape-2">EN TRAVAUX</div>
                <div style="text-align: center; max-width: 600px; padding: 20px; background: rgba(255,255,255,0.9); border-radius: 15px; box-shadow: 0 5px 20px rgba(0,0,0,0.2);">
                    <div style="font-size: 6rem; margin-bottom: 20px;">${icon}</div>
                    <h1 style="margin: 10px 0; font-size: 3rem; text-transform: uppercase; color: #333;">${title}</h1>
                    <p style="font-size: 1.5rem; line-height: 1.6; color: #666; margin: 30px 0;">${desc}</p>
                </div>
            </div>`;

    } else {
        overlay.style.background = "white";
        overlayContentBox.innerHTML = `
            <div class="start-icon" id="ov-icon" style="font-size: 8rem;">${icon}</div>
            <div class="start-title" id="ov-title">${title}</div>
            <div class="start-subtitle">Démarrer cette chaîne ?</div>`;
    }
}

/* =========================================
   5. ANIMATION & NAVIGATION
   ======================================== */
function zoomChannel(element) {
    if (element.classList.contains('empty')) return;
    
    // Lance les sons d'entrée
    playChannelSequence();
    
    activeCard = element;
    renderOverlayContent(element);

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

    // --- ICI : ON JOUE LE SON DE RETOUR ---
    sfxBack.currentTime = 0;
    sfxBack.play().catch(e => console.warn("Audio Back bloqué:", e));
    
    // On arrête les sons de la chaîne
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
    const channels = Array.from(document.querySelectorAll('.channel:not(.empty)'));
    if (channels.length < 2) return;
    
    stopChannelSequence();
    playChannelSequence();
    
    const currentIndex = channels.indexOf(activeCard);
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = channels.length - 1;
    if (newIndex >= channels.length) newIndex = 0;
    const nextCard = channels[newIndex];
    activeCard.classList.remove('hidden');
    nextCard.classList.add('hidden');
    activeCard = nextCard;
    renderOverlayContent(nextCard);
}

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    // Format 24h
    const hEl = document.getElementById('h');
    const mEl = document.getElementById('m');
    const ampmEl = document.getElementById('ampm');
    const dateEl = document.getElementById('date');

    if(hEl) hEl.innerText = hours; 
    if(mEl) mEl.innerText = minutes; 
    if(ampmEl) ampmEl.innerText = '';
    if(dateEl) {
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        dateEl.innerText = `${days[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
    }
}
setInterval(updateClock, 1000);
updateClock();