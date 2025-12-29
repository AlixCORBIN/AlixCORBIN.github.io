/* =========================================
   1. SÉLECTION DES ÉLÉMENTS DU DOM
   ========================================= */
const introScreen = document.getElementById('intro-screen');
const mainGrid = document.getElementById('main-grid');
const bgMusic = document.getElementById('bg-music');

const overlay = document.getElementById('full-overlay');
const overlayContentBox = document.querySelector('.overlay-content'); // La boîte blanche/contenu
const startBtn = document.getElementById('start-btn-action');
const mainFooter = document.getElementById('main-footer');

// Variables d'état
let activeCard = null;

/* =========================================
   2. GESTION DE L'INTRODUCTION
   ========================================= */
function startExperience() {
    // Gestion de l'audio (avec sécurité pour les navigateurs)
    if (bgMusic) {
        bgMusic.volume = 0.5;
        bgMusic.play().catch(e => console.warn("Lecture auto bloquée par le navigateur :", e));
    }

    // Animation de disparition de l'intro
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

    // Récupération des données
    const title = element.dataset.title;
    const icon = element.dataset.icon; // Peut être un émoji, une balise <img> ou un chemin d'image
    const link = element.dataset.link;
    const desc = element.dataset.desc || ""; // Nouveau : description pour la page Culture

    // --- RESET DES STYLES ---
    // Important : on remet les styles par défaut pour éviter les conflits
    overlayContentBox.style.padding = ''; 
    overlayContentBox.style.justifyContent = 'center';
    overlayContentBox.style.alignItems = 'center';
    overlayContentBox.style.overflow = '';
    overlayContentBox.style.display = 'flex';
    overlayContentBox.style.flexDirection = 'column'; 
    overlayContentBox.style.color = ''; // Reset couleur texte
    overlay.style.background = '';      // Reset fond
    
    // Action du bouton
    if (startBtn) {
        startBtn.onclick = () => {
            if (link) window.open(link, '_blank');
        };
        // Changer le texte du bouton si c'est le profil
        startBtn.innerText = (title === 'Moi') ? "Voir mon CV" : "Démarrer";
    }

    // --- LOGIQUE D'AFFICHAGE ---

    if (title === 'Moi') {
        // === CAS 1 : PROFIL (MOI) ===
        overlay.style.background = "linear-gradient(to bottom, #fff8f0 0%, #ffeecf 100%)";
        
        overlayContentBox.innerHTML = `
            <div class="tobias-layout">
                <img src="assets/maphoto.png" class="tobias-avatar" alt="Alix Corbin">
                
                <div class="tobias-intro">
                    Salut ! Je m'appelle <span class="name-highlight">Alix Corbin</span>, et je suis étudiant à Laval.
                </div>
                
                <div class="tobias-sub">
                    Actuellement en <span class="blue-highlight">2e année de BUT Info</span>, je suis passionné par le <span class="blue-highlight">Développement Logiciel</span>.
                </div>
                
                <div class="tobias-desc">
                    Compétent en <span class="blue-highlight">Java, Web & SQL</span>, j'aime le travail d'équipe.
                    <br><br>
                    Je recherche un stage de <span class="name-highlight">8 à 12 semaines</span> à partir du <span class="name-highlight">13 Avril 2026</span>.
                </div>
                
                <div class="tobias-cta">
                    Appuyez sur "Voir mon CV" pour en savoir plus.
                </div>
            </div>
        `;

    } else if (title === 'Blackjack') {
        // === CAS 2 : BLACKJACK ===
        overlay.style.background = "black";
        
        // Styles spécifiques pour l'image plein écran
        overlayContentBox.style.padding = '0';
        overlayContentBox.style.overflow = 'hidden';
        overlayContentBox.style.display = 'flex';
        overlayContentBox.style.alignItems = 'center';
        overlayContentBox.style.justifyContent = 'center';
        
        overlayContentBox.innerHTML = icon; // On suppose que data-icon contient la balise <img>

        // Ciblage spécifique de l'image injectée
        const img = overlayContentBox.querySelector('img');
        if (img) {
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "contain"; 
            img.style.borderRadius = "0";
            img.style.boxShadow = "none";
        }

    } else if (title === 'Culture') {
        // === CAS 3 : CULTURE (Image de fond + Texte par-dessus) ===
        
        overlay.style.background = "black";
        overlayContentBox.style.padding = '0';
        overlayContentBox.style.overflow = 'hidden'; // Empêche de déborder sur le footer
        
        // Ici icon contient le chemin de l'image (assets/culture_bg.png)
        overlayContentBox.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                
                <img src="${icon}" style="position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: cover; opacity: 0.5;">
                
                <div style="position: relative; z-index: 10; color: white; padding: 20px; max-width: 80%;">
                    <div style="font-size: 5rem; margin-bottom: 20px; text-shadow: 0 4px 15px rgba(0,0,0,0.8);">🎬</div>
                    <h1 style="font-size: 3rem; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 3px; text-shadow: 0 4px 10px rgba(0,0,0,1);">CULTURE G</h1>
                    <p style="font-size: 1.5rem; line-height: 1.5; font-weight: 300; text-shadow: 0 2px 5px rgba(0,0,0,1); color: #ddd;">
                        ${desc}
                    </p>
                </div>
            </div>
        `;

    } else {
        // === CAS 4 : DÉFAUT (Autres projets) ===
        overlay.style.background = "white"; // ou var(--bg-color)
        
        overlayContentBox.innerHTML = `
            <div class="start-icon" id="ov-icon" style="font-size: 8rem;">${icon}</div>
            <div class="start-title" id="ov-title">${title}</div>
            <div class="start-subtitle">Démarrer cette chaîne ?</div>
        `;
    }
}

/* =========================================
   4. ANIMATION D'OUVERTURE (ZOOM)
   ========================================= */
function zoomChannel(element) {
    if (element.classList.contains('empty')) return;
    
    activeCard = element;
    renderOverlayContent(element); // Préparer le contenu

    // Calcul de la position de départ
    const rect = element.getBoundingClientRect();
    
    // Configuration initiale de l'overlay (positionné sur la carte)
    overlay.style.display = 'flex';
    overlay.style.transition = 'none'; // Pas de transition pour le positionnement initial
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.borderRadius = '20px';
    
    // Cacher le footer
    if (mainFooter) mainFooter.classList.add('footer-hidden');
    
    // Forcer le "Reflow" pour que le navigateur prenne en compte la position initiale
    overlay.offsetHeight; 
    
    // Animation vers le plein écran
    overlay.style.transition = 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    overlay.style.top = '0px';
    overlay.style.left = '0px';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.borderRadius = '0px';
    
    // Cacher la carte originale pendant le zoom
    element.classList.add('hidden');
    
    // Activer l'interface de l'overlay (boutons, texte) après un court délai
    setTimeout(() => { overlay.classList.add('active'); }, 50);
}

/* =========================================
   5. FERMETURE DU ZOOM
   ========================================= */
function closeZoom() {
    if (!activeCard) return;

    // Cacher l'interface de l'overlay
    overlay.classList.remove('active');

    // Récupérer la position où la carte doit retourner
    const rect = activeCard.getBoundingClientRect();

    // Animation retour
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.borderRadius = '20px';

    // Réafficher le footer
    if (mainFooter) mainFooter.classList.remove('footer-hidden');

    // Nettoyage à la fin de l'animation
    setTimeout(() => {
        overlay.style.display = 'none';
        activeCard.classList.remove('hidden');
        activeCard = null;
    }, 600); // Doit correspondre à la durée CSS (0.6s)
}

/* =========================================
   6. NAVIGATION (FLÈCHES GAUCHE/DROITE)
   ========================================= */
function navigate(direction) {
    // Récupérer toutes les chaînes valides
    const channels = Array.from(document.querySelectorAll('.channel:not(.empty)'));
    if (channels.length < 2) return;

    const currentIndex = channels.indexOf(activeCard);
    let newIndex = currentIndex + direction;

    // Boucle infinie
    if (newIndex < 0) newIndex = channels.length - 1;
    if (newIndex >= channels.length) newIndex = 0;

    const nextCard = channels[newIndex];

    // Mettre à jour la carte active (visuellement en arrière-plan)
    activeCard.classList.remove('hidden');
    nextCard.classList.add('hidden');
    activeCard = nextCard;

    // Mettre à jour le contenu de l'overlay SANS fermer la fenêtre
    renderOverlayContent(nextCard);
}

/* =========================================
   7. HORLOGE ET DATE
   ========================================= */
function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    // Format 12h (AM/PM) pour le style Wii
    const ampm = hours >= 12 ? 'PM' : 'AM'; 
    hours = hours % 12; 
    hours = hours ? hours : 12; // "0" devient "12"

    const hEl = document.getElementById('h');
    const mEl = document.getElementById('m');
    const ampmEl = document.getElementById('ampm');
    const dateEl = document.getElementById('date');

    if(hEl) hEl.innerText = hours; 
    if(mEl) mEl.innerText = minutes; 
    if(ampmEl) ampmEl.innerText = ampm;

    if(dateEl) {
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        // Note: getMonth() commence à 0 (Janvier = 0)
        dateEl.innerText = `${days[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
    }
}

// Lancer l'horloge
setInterval(updateClock, 1000);
updateClock();