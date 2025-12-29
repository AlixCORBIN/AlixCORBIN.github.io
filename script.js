/* =========================================
   1. SÉLECTION DES ÉLÉMENTS DU DOM
   ========================================= */
const introScreen = document.getElementById('intro-screen');
const mainGrid = document.getElementById('main-grid');
const bgMusic = document.getElementById('bg-music');

const overlay = document.getElementById('full-overlay');
const overlayContentBox = document.querySelector('.overlay-content');
const startBtn = document.getElementById('start-btn-action');
const mainFooter = document.getElementById('main-footer');

let activeCard = null;

/* =========================================
   2. GESTION DE L'INTRODUCTION
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
   3. GESTION DU CONTENU DE L'OVERLAY
   ========================================= */
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
    
    // Action du bouton
    if (startBtn) {
        startBtn.onclick = () => {
            if (link) window.open(link, '_blank');
        };
        startBtn.innerText = (title === 'Moi') ? "Voir mon CV" : "Démarrer";
    }

    // --- LOGIQUE D'AFFICHAGE ---

    if (title === 'Moi') {
        // === CAS : PROFIL ===
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
        // === CAS : BLACKJACK ===
        overlay.style.background = "black";
        overlayContentBox.style.padding = '0';
        overlayContentBox.style.overflow = 'hidden';
        overlayContentBox.innerHTML = icon;
        const img = overlayContentBox.querySelector('img');
        if (img) { img.style.width = "100%"; img.style.height = "100%"; img.style.objectFit = "contain"; }

    } else if (title === 'Culture') {
        // === CAS : CULTURE ===
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
        // === CAS : BUT INFO ===
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
        // === CAS : ARDUINO (Le nouveau bloc !) ===
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

    } else {
        // === CAS : DÉFAUT ===
        overlay.style.background = "white";
        overlayContentBox.innerHTML = `
            <div class="start-icon" id="ov-icon" style="font-size: 8rem;">${icon}</div>
            <div class="start-title" id="ov-title">${title}</div>
            <div class="start-subtitle">Démarrer cette chaîne ?</div>`;
    }
}

/* =========================================
   4. ANIMATION & NAVIGATION
   ========================================= */
function zoomChannel(element) {
    if (element.classList.contains('empty')) return;
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