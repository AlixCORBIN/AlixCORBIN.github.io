
function startExperience() {
    const intro = document.getElementById('intro-screen');
    const grid = document.getElementById('main-grid');
    const audio = document.getElementById('bg-music');
    audio.volume = 0.5; audio.play().catch(e => console.log(e));
    intro.style.opacity = '0';
    setTimeout(() => { intro.style.display = 'none'; grid.classList.add('grid-visible'); }, 500);
}

const overlay = document.getElementById('full-overlay');
const startBtn = document.getElementById('start-btn-action');
const mainFooter = document.getElementById('main-footer');
let activeCard = null;

function renderOverlayContent(element) {
    const title = element.dataset.title;
    const icon = element.dataset.icon;
    const link = element.dataset.link;
    const contentBox = document.querySelector('.overlay-content');
    
    // Reset du style
    contentBox.style.padding = ''; 
    contentBox.style.justifyContent = 'center';
    
    startBtn.onclick = () => window.open(link, '_blank');

    if (title === 'Moi') {
        overlay.style.background = "linear-gradient(to bottom, #fff8f0 0%, #ffeecf 100%)";
        contentBox.innerHTML = `
            <div class="tobias-layout">
                <img src="assets/maphoto.png" class="tobias-avatar" alt="Alix Corbin">
                <div class="tobias-intro">
                    Salut ! Je m'appelle <span class="name-highlight">Alix Corbin</span>, et je suis étudiant basé à Laval/Le Mans.
                </div>
                <div class="tobias-sub">
                    Je prépare un <span class="blue-highlight">BUT Informatique</span> et je suis passionné par le <span class="blue-highlight">Développement Logiciel</span>.
                </div>
                <div class="tobias-desc">
                    Compétent en <span class="blue-highlight">Programmation</span>, <span class="blue-highlight">Travail d'équipe</span> et doté d'un bon relationnel.
                    <br>Je recherche un stage de 8 à 12 semaines à partir d'Avril 2026.
                </div>
                <div class="tobias-cta">
                    Appuyez sur "Démarrer" pour voir mon CV.
                </div>
            </div>
        `;
/* DANS script.js, à l'intérieur de renderOverlayContent */

    } else if (title === 'Blackjack') {
        // CAS 2 : BLACKJACK
        
        // Fond noir
        overlay.style.background = "black";
        
        // On enlève les marges
        contentBox.style.padding = '0';
        
        // IMPORTANT : On empêche le contenu de déborder et de cacher le footer
        contentBox.style.overflow = 'hidden'; 
        contentBox.style.display = 'flex';
        contentBox.style.alignItems = 'center'; // Centre l'image verticalement
        
        contentBox.innerHTML = icon;

        const img = contentBox.querySelector('img');
        if (img) {
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "contain"; // "contain" affiche toute l'image, "cover" remplit tout l'espace
            img.style.borderRadius = "0";
            img.style.boxShadow = "none";
        }

    } else {
        overlay.style.background = "white";
        contentBox.innerHTML = `
            <div class="start-icon" id="ov-icon">${icon}</div>
            <div class="start-title" id="ov-title">${title}</div>
            <div class="start-subtitle">Démarrer cette chaîne ?</div>
        `;
    }
}

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
    
    mainFooter.classList.add('footer-hidden');
    
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

function closeZoom() {
    if (!activeCard) return;
    overlay.classList.remove('active');
    const rect = activeCard.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.borderRadius = '20px';
    mainFooter.classList.remove('footer-hidden');
    setTimeout(() => {
        overlay.style.display = 'none';
        activeCard.classList.remove('hidden');
        activeCard = null;
    }, 600);
}

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM'; hours = hours % 12; hours = hours ? hours : 12;
    document.getElementById('h').innerText = hours; 
    document.getElementById('m').innerText = minutes; 
    document.getElementById('ampm').innerText = ampm;
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    document.getElementById('date').innerText = `${days[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
}
setInterval(updateClock, 1000); updateClock();