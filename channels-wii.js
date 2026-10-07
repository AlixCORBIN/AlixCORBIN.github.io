/* =========================================
   CHAÎNES STYLE WII
   Fond clair, pictogramme dessiné à la main (SVG), titre arrondi
   d'une seule couleur. Remplace les cartes emoji / néon / images IA.
   Les cartes avec une vraie capture (Blackjack, Morpion) sont gardées telles quelles.
   ========================================= */

// Pictogrammes : traits épais arrondis, 2 tons (gris foncé + couleur de la chaîne)
const WII_ICONS = {
    briefcase: c => `
        <rect x="10" y="22" width="60" height="40" rx="7" fill="${c}" />
        <rect x="10" y="22" width="60" height="16" rx="7" fill="#fff" opacity=".25"/>
        <path d="M30 22v-6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6" fill="none" stroke="#5b6270" stroke-width="5" stroke-linecap="round"/>
        <rect x="35" y="36" width="10" height="8" rx="2" fill="#fff"/>`,
    cap: c => `
        <path d="M40 14 76 30 40 46 4 30Z" fill="${c}"/>
        <path d="M20 37v12c0 5 9 10 20 10s20-5 20-10V37L40 46Z" fill="#5b6270"/>
        <path d="M70 32v18" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="70" cy="53" r="4" fill="${c}"/>`,
    clapper: c => `
        <rect x="10" y="32" width="60" height="34" rx="5" fill="#5b6270"/>
        <path d="M10 22 66 12l3 14-56 10Z" fill="${c}"/>
        <path d="M22 20l8 14M36 17l8 14M50 15l8 14" stroke="#fff" stroke-width="5"/>
        <rect x="18" y="42" width="44" height="5" rx="2.5" fill="#fff" opacity=".35"/>
        <rect x="18" y="52" width="30" height="5" rx="2.5" fill="#fff" opacity=".35"/>`,
    chip: c => `
        <rect x="20" y="20" width="40" height="40" rx="6" fill="#5b6270"/>
        <rect x="30" y="30" width="20" height="20" rx="3" fill="${c}"/>
        <g stroke="#5b6270" stroke-width="5" stroke-linecap="round">
            <path d="M30 20v-8M40 20v-8M50 20v-8M30 60v8M40 60v8M50 60v8M20 30h-8M20 40h-8M20 50h-8M60 30h8M60 40h8M60 50h8"/>
        </g>`,
    mugs: c => `
        <rect x="10" y="26" width="26" height="36" rx="4" fill="${c}"/>
        <path d="M36 34h5a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-5" fill="none" stroke="${c}" stroke-width="5"/>
        <path d="M8 26a6 6 0 0 1 8-8 7 7 0 0 1 12 0 6 6 0 0 1 10 6v2H8Z" fill="#fff" stroke="#c9ced6" stroke-width="2"/>
        <rect x="44" y="30" width="26" height="32" rx="4" fill="#5b6270"/>
        <path d="M70 37h3a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-3" fill="none" stroke="#5b6270" stroke-width="5"/>
        <rect x="15" y="34" width="4" height="22" rx="2" fill="#fff" opacity=".35"/>`,
    trophy: c => `
        <path d="M24 12h32v18a16 16 0 0 1-32 0Z" fill="${c}"/>
        <path d="M24 18h-8a8 8 0 0 0 8 14M56 18h8a8 8 0 0 1-8 14" fill="none" stroke="${c}" stroke-width="5"/>
        <rect x="36" y="44" width="8" height="10" fill="#5b6270"/>
        <rect x="24" y="54" width="32" height="10" rx="3" fill="#5b6270"/>
        <rect x="30" y="16" width="5" height="18" rx="2.5" fill="#fff" opacity=".4"/>`,
    building: c => `
        <rect x="14" y="16" width="34" height="50" rx="3" fill="#5b6270"/>
        <rect x="48" y="32" width="20" height="34" rx="3" fill="${c}"/>
        <g fill="#fff" opacity=".8">
            <rect x="20" y="24" width="8" height="7" rx="1"/><rect x="34" y="24" width="8" height="7" rx="1"/>
            <rect x="20" y="37" width="8" height="7" rx="1"/><rect x="34" y="37" width="8" height="7" rx="1"/>
            <rect x="20" y="50" width="8" height="7" rx="1"/><rect x="34" y="50" width="8" height="7" rx="1"/>
            <rect x="53" y="40" width="10" height="5" rx="1"/><rect x="53" y="50" width="10" height="5" rx="1"/>
        </g>`,
    factory: c => `
        <path d="M8 66V36l16 10V36l16 10V36l16 10V18h12v48Z" fill="#5b6270"/>
        <rect x="56" y="12" width="12" height="6" rx="2" fill="${c}"/>
        <g fill="${c}"><rect x="14" y="52" width="8" height="8" rx="1"/><rect x="30" y="52" width="8" height="8" rx="1"/><rect x="46" y="52" width="8" height="8" rx="1"/></g>`,
    pen: c => `
        <path d="M54 10l16 16-36 36-20 4 4-20Z" fill="${c}"/>
        <path d="M18 46l16 16" stroke="#5b6270" stroke-width="5"/>
        <path d="M14 66l4-20 16 16Z" fill="#5b6270"/>
        <path d="M10 70h60" stroke="#c9ced6" stroke-width="4" stroke-linecap="round"/>`,
    weather: c => `
        <circle cx="30" cy="28" r="14" fill="${c}"/>
        <g stroke="${c}" stroke-width="4" stroke-linecap="round"><path d="M30 6v4M8 28h4M14 12l3 3M46 12l-3 3"/></g>
        <path d="M26 64a12 12 0 0 1 0-24 16 16 0 0 1 30-2 12 12 0 0 1 4 26Z" fill="#fff" stroke="#c9ced6" stroke-width="3"/>`,
    chart: c => `
        <path d="M10 66h62" stroke="#5b6270" stroke-width="5" stroke-linecap="round"/>
        <rect x="14" y="40" width="12" height="22" rx="3" fill="#5b6270"/>
        <rect x="32" y="26" width="12" height="36" rx="3" fill="${c}"/>
        <rect x="50" y="14" width="12" height="48" rx="3" fill="#5b6270"/>`,
};

// Config des chaînes redessinées, clé = title FR
const WII_CARDS = {
    'Profil Pro':       { icon: 'briefcase', color: '#6c5ce7', sub: () => '<span class="wii-pill">S4</span><span class="wii-pill">Full-Stack</span>' },
    'BUT Informatique': { icon: 'cap',       color: '#2f80ed' },
    'Culture':          { icon: 'clapper',   color: '#e2574c' },
    'Arduino':          { icon: 'chip',      color: '#00979d' },
    'Projet Jeu':       { icon: 'mugs',      color: '#f2a516' },
    'Récompenses':      { icon: 'trophy',    color: '#e0a400', sub: () => `<span class="wii-sub-text">${currentLang === 'en' ? '3 prizes' : '3 prix'}</span>` },
    'Stage':            { icon: 'building',  color: '#ef8a17', sub: () => '<span class="wii-pill wii-pill--no">15 ✕</span><span class="wii-pill">10 ○</span><span class="wii-pill wii-pill--ok">1 ✓</span>' },
    'Alternance':       { icon: 'factory',   color: '#0091d5' },
    'Écri+':            { icon: 'pen',       color: '#2eaa5c', sub: d => `<span class="wii-pill wii-pill--ok">${d.cardScore} pts</span>` },
    'Météo':            { icon: 'weather',   color: '#f5b400', sub: () => '<span class="wii-sub-text" id="meteo-card-sub">--°C</span>' },
    'Statistiques':     { icon: 'chart',     color: '#22a6c8' },
};

function createWiiCard(data) {
    const cfg = WII_CARDS[data.title];
    if (!cfg) return null;
    const label = (currentLang === 'en' && data.cardLabelEn) ? data.cardLabelEn : (data.cardLabel || data.title);
    const div = document.createElement('div');
    div.className = 'channel wii-card';
    div._channelData = data;
    div.onclick = () => zoomChannel(div);
    div.setAttribute('role', 'button');
    div.tabIndex = 0;
    div.setAttribute('aria-label', (currentLang === 'en' && data.titleEn) ? data.titleEn : data.title);
    div.style.setProperty('--ch', cfg.color);
    div.innerHTML = `
        <div class="channel-inner wii-card-inner">
            <svg class="wii-icon" viewBox="0 0 80 76" aria-hidden="true">${WII_ICONS[cfg.icon](cfg.color)}</svg>
            <div class="wii-title">${label}</div>
            ${cfg.sub ? `<div class="wii-sub">${cfg.sub(data)}</div>` : ''}
        </div>`;
    return div;
}

// Bandeau de titre propre pour les cartes photo (Moi, IHM)
function createWiiPhotoCard(data, imgSrc, label, extraClass = '') {
    const div = document.createElement('div');
    div.className = 'channel wii-photo ' + extraClass;
    div._channelData = data;
    div.onclick = () => zoomChannel(div);
    div.setAttribute('role', 'button');
    div.tabIndex = 0;
    div.setAttribute('aria-label', (currentLang === 'en' && data.titleEn) ? data.titleEn : data.title);
    div.innerHTML = `
        <div class="channel-inner">
            <img src="${imgSrc}" class="ch-bg" alt="">
            <div class="wii-photo-band">${label}</div>
        </div>`;
    return div;
}
