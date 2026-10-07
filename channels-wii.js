/* =========================================
   CHAÎNES STYLE WII
   Chaque chaîne = une petite scène illustrée plein cadre (SVG),
   animée en douceur, avec un bandeau titre blanc commun à toutes.
   Les cartes avec une vraie capture (Blackjack, Morpion) restent telles quelles.
   ========================================= */

// Toutes les scènes sont en viewBox 320x180 et remplissent la tuile.
const WII_SCENES = {

    // Profil Pro : CV posé sur un bureau
    profil: () => `
        <rect width="320" height="180" fill="#ece8ff"/>
        <circle cx="270" cy="20" r="80" fill="#ddd5ff"/>
        <circle cx="30" cy="170" r="60" fill="#e3ddff"/>
        <g transform="rotate(-6 150 80)">
            <rect x="96" y="18" width="118" height="140" rx="6" fill="#fff" stroke="#d6cff5" stroke-width="2"/>
            <rect x="108" y="32" width="30" height="34" rx="4" fill="#6c5ce7"/>
            <circle cx="123" cy="44" r="7" fill="#fff" opacity=".9"/>
            <path d="M112 64a11 9 0 0 1 22 0" fill="#fff" opacity=".9"/>
            <rect x="146" y="36" width="56" height="7" rx="3.5" fill="#4b4f5c"/>
            <rect x="146" y="50" width="40" height="5" rx="2.5" fill="#b9b3d9"/>
            <g fill="#e3e0f0">
                <rect x="108" y="80" width="94" height="5" rx="2.5"/><rect x="108" y="92" width="80" height="5" rx="2.5"/>
                <rect x="108" y="110" width="94" height="5" rx="2.5"/><rect x="108" y="122" width="66" height="5" rx="2.5"/>
            </g>
        </g>
        <g class="wii-float">
            <rect x="222" y="54" width="62" height="22" rx="11" fill="#6c5ce7"/>
            <text x="253" y="69.5" text-anchor="middle" class="wii-svg-txt" fill="#fff" font-size="11">Full-Stack</text>
        </g>
        <g class="wii-float wii-delay">
            <rect x="40" y="70" width="40" height="22" rx="11" fill="#fff" stroke="#c9c0f5" stroke-width="2"/>
            <text x="60" y="85.5" text-anchor="middle" class="wii-svg-txt" fill="#6c5ce7" font-size="11">S4</text>
        </g>`,

    // BUT Informatique : écran de code + toque
    but: () => `
        <rect width="320" height="180" fill="#e3efff"/>
        <path d="M0 140h320v40H0z" fill="#cfe2fb"/>
        <rect x="70" y="26" width="150" height="100" rx="8" fill="#24324a"/>
        <rect x="78" y="34" width="134" height="84" rx="4" fill="#1b2638"/>
        <g font-family="monospace" font-size="10" font-weight="700">
            <text x="86" y="52" fill="#7fb4ff">class</text><text x="122" y="52" fill="#fff">Etudiant {</text>
            <text x="96" y="68" fill="#ffcc66">annee</text><text x="130" y="68" fill="#fff">= 2;</text>
            <text x="96" y="84" fill="#ffcc66">iut</text><text x="118" y="84" fill="#9be59b">"Laval"</text>
            <text x="86" y="100" fill="#fff">}</text>
            <rect class="wii-blink" x="94" y="92" width="6" height="10" fill="#7fb4ff"/>
        </g>
        <rect x="132" y="126" width="26" height="12" fill="#24324a"/>
        <rect x="112" y="138" width="66" height="6" rx="3" fill="#24324a"/>
        <g transform="translate(218 66) rotate(12)"><g class="wii-float">
            <path d="M40 0 80 16 40 32 0 16Z" fill="#2f80ed"/>
            <path d="M16 23v12c0 5 11 9 24 9s24-4 24-9V23L40 32Z" fill="#1d4f9a"/>
            <path d="M72 18v20" stroke="#ffc83d" stroke-width="3"/><circle cx="72" cy="41" r="4" fill="#ffc83d"/>
        </g></g>`,

    // Culture : salle de cinéma
    culture: () => `
        <rect width="320" height="180" fill="#2b1d2e"/>
        <rect x="70" y="22" width="180" height="104" rx="6" fill="#f7efe4"/>
        <g class="wii-flicker"><rect x="70" y="22" width="180" height="104" rx="6" fill="#fff6d8" opacity=".55"/></g>
        <path d="M148 56v38l32-19Z" fill="#e2574c"/>
        <path d="M0 0h80c-6 50-10 120-4 180H0Z" fill="#c8372d"/>
        <path d="M320 0h-80c6 50 10 120 4 180h76Z" fill="#c8372d"/>
        <g stroke="#a82b22" stroke-width="3" opacity=".7">
            <path d="M22 0c-4 60-4 120 0 180M48 0c-4 60-4 120 0 180M272 0c4 60 4 120 0 180M298 0c4 60 4 120 0 180"/>
        </g>
        <path d="M0 0h320v14H0z" fill="#a82b22"/>
        <g fill="#3d2a40">
            <circle cx="100" cy="176" r="18"/><circle cx="140" cy="172" r="18"/><circle cx="180" cy="174" r="18"/><circle cx="220" cy="176" r="18"/>
        </g>`,

    // Arduino : carte électronique avec LED qui clignote
    arduino: () => `
        <rect width="320" height="180" fill="#0f6e73"/>
        <g stroke="#2a9097" stroke-width="3" fill="none" opacity=".8">
            <path d="M0 40h60l20 20h40M0 120h50l30-30h30M320 50h-70l-20 20h-30M320 130h-60l-30-30h-20M160 0v40M160 180v-40"/>
        </g>
        <g fill="#c9a24a"><circle cx="60" cy="40" r="4"/><circle cx="50" cy="120" r="4"/><circle cx="250" cy="50" r="4"/><circle cx="260" cy="130" r="4"/></g>
        <rect x="112" y="42" width="96" height="96" rx="8" fill="#1f2a30"/>
        <g stroke="#c9ced6" stroke-width="5" stroke-linecap="round">
            <path d="M128 42v-10M144 42v-10M160 42v-10M176 42v-10M192 42v-10M128 138v10M144 138v10M160 138v10M176 138v10M192 138v10"/>
            <path d="M112 58h-10M112 74h-10M112 90h-10M112 106h-10M112 122h-10M208 58h10M208 74h10M208 90h10M208 106h10M208 122h10"/>
        </g>
        <rect x="134" y="64" width="52" height="52" rx="4" fill="#2c3a42"/>
        <text x="160" y="96" text-anchor="middle" font-family="monospace" font-weight="700" font-size="13" fill="#7fd6d9">ATmega</text>
        <circle cx="262" cy="96" r="9" fill="#ff5d4f" class="wii-led"/>
        <circle cx="262" cy="96" r="20" fill="#ff5d4f" opacity=".25" class="wii-led"/>
        <path d="M256 104v14M268 104v14" stroke="#c9ced6" stroke-width="3"/>`,

    // GlouGlou : deux chopes qui trinquent, bulles qui montent
    jeu: () => `
        <rect width="320" height="180" fill="#fff3d6"/>
        <circle cx="160" cy="80" r="70" fill="#ffe6a6"/>
        <path d="M0 150h320v30H0z" fill="#c98b4a"/><path d="M0 150h320v6H0z" fill="#b57a3d"/>
        <g transform="rotate(-12 120 100)">
            <rect x="88" y="66" width="50" height="76" rx="6" fill="#f2a516"/>
            <rect x="96" y="76" width="6" height="56" rx="3" fill="#fff" opacity=".35"/>
            <path d="M138 80h10a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10h-10" fill="none" stroke="#f2a516" stroke-width="8"/>
            <path d="M84 68a10 10 0 0 1 14-12 12 12 0 0 1 22-2 10 10 0 0 1 20 8v6H84Z" fill="#fff"/>
        </g>
        <g transform="rotate(12 200 100)">
            <rect x="182" y="66" width="50" height="76" rx="6" fill="#e8951a"/>
            <rect x="190" y="76" width="6" height="56" rx="3" fill="#fff" opacity=".35"/>
            <path d="M182 80h-10a10 10 0 0 0-10 10v20a10 10 0 0 0 10 10h10" fill="none" stroke="#e8951a" stroke-width="8"/>
            <path d="M178 68a10 10 0 0 1 14-12 12 12 0 0 1 22-2 10 10 0 0 1 20 8v6h-56Z" fill="#fff"/>
        </g>
        <g fill="#fff" class="wii-bubbles">
            <circle cx="112" cy="120" r="3"/><circle cx="122" cy="132" r="2"/><circle cx="206" cy="124" r="3"/><circle cx="214" cy="110" r="2"/>
        </g>
        <path d="M150 40l6 10M160 34v12M170 40l-6 10" stroke="#f2a516" stroke-width="4" stroke-linecap="round" class="wii-blink"/>`,

    // Récompenses : podium + trophée + confettis
    awards: () => `
        <rect width="320" height="180" fill="#fff6dc"/>
        <g class="wii-confetti">
            <rect x="40" y="20" width="8" height="4" fill="#e2574c" transform="rotate(30 44 22)"/>
            <rect x="80" y="44" width="8" height="4" fill="#2f80ed" transform="rotate(-20 84 46)"/>
            <rect x="250" y="26" width="8" height="4" fill="#2eaa5c" transform="rotate(40 254 28)"/>
            <rect x="276" y="60" width="8" height="4" fill="#6c5ce7" transform="rotate(-35 280 62)"/>
            <circle cx="214" cy="18" r="3" fill="#e2574c"/><circle cx="110" cy="16" r="3" fill="#2eaa5c"/>
        </g>
        <rect x="100" y="112" width="40" height="44" fill="#c9ced6"/><rect x="140" y="96" width="40" height="60" fill="#f0c43c"/><rect x="180" y="124" width="40" height="32" fill="#d99a5b"/>
        <g font-family="Nunito, sans-serif" font-weight="900" font-size="18" fill="#fff" text-anchor="middle">
            <text x="120" y="140">2</text><text x="160" y="128">1</text><text x="200" y="148">3</text>
        </g>
        <path d="M0 156h320v24H0z" fill="#efe2b8"/>
        <g class="wii-float">
            <path d="M144 34h32v20a16 16 0 0 1-32 0Z" fill="#e0a400"/>
            <path d="M144 40h-8a8 8 0 0 0 8 14M176 40h8a8 8 0 0 1-8 14" fill="none" stroke="#e0a400" stroke-width="4"/>
            <rect x="156" y="70" width="8" height="10" fill="#8a6a10"/><rect x="148" y="80" width="24" height="8" rx="2" fill="#8a6a10"/>
            <rect x="150" y="38" width="4" height="16" rx="2" fill="#fff" opacity=".5"/>
        </g>`,

    // Stage : 26 candidatures, une seule acceptée
    stage: () => {
        const en = currentLang === 'en';
        let dots = '';
        const cols = 13;
        for (let i = 0; i < 26; i++) {
            const x = 50 + (i % cols) * 18.5, y = 52 + Math.floor(i / cols) * 34;
            const ok = i === 25, no = i < 15;
            const fill = ok ? '#2eaa5c' : no ? '#f2b8b2' : '#d8dde4';
            dots += `<g class="${ok ? 'wii-pop' : ''}" transform="translate(${x} ${y})">
                <rect x="-7" y="-9" width="14" height="18" rx="2" fill="${fill}"/>
                ${ok ? '<path d="M-4 0l3 3 5-6" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>' : ''}
            </g>`;
        }
        return `
        <rect width="320" height="180" fill="#fff1e3"/>
        <circle cx="300" cy="10" r="70" fill="#ffe3c6"/>
        ${dots}
        <g font-family="Nunito, sans-serif" font-weight="900" font-size="13" text-anchor="middle">
            <rect x="60" y="112" width="58" height="22" rx="11" fill="#fbe3e1"/><text x="89" y="127" fill="#c0453b">${en ? '15 no' : '15 refus'}</text>
            <rect x="126" y="112" width="68" height="22" rx="11" fill="#e6e9ee"/><text x="160" y="127" fill="#5b6270">${en ? '10 pending' : '10 attente'}</text>
            <rect x="202" y="112" width="58" height="22" rx="11" fill="#2eaa5c"/><text x="231" y="127" fill="#fff">${en ? '1 yes!' : '1 oui !'}</text>
        </g>`;
    },

    // Alternance : banc turbine (hélice qui tourne) + usine
    alternance: () => `
        <rect width="320" height="180" fill="#e2f2fb"/>
        <path d="M0 150V96l30 18V96l30 18V96l30 18V60h20v90Z" fill="#9fc3d8"/>
        <path d="M0 150h320v30H0z" fill="#7fa9c2"/>
        <rect x="150" y="70" width="130" height="64" rx="10" fill="#0a2540"/>
        <rect x="160" y="80" width="54" height="44" rx="4" fill="#0f3a62"/>
        <polyline points="164,112 174,104 184,108 194,92 204,96 210,88" fill="none" stroke="#4ac0e0" stroke-width="3" stroke-linecap="round"/>
        <circle cx="250" cy="102" r="24" fill="#0f3a62"/>
        <g class="wii-spin" style="transform-origin:250px 102px">
            <path d="M250 102l-4-20h8Z M250 102l20-4v8Z M250 102l4 20h-8Z M250 102l-20 4v-8Z" fill="#0091d5"/>
            <path d="M250 102l-14-14 6-4Z M250 102l14-14 4 6Z M250 102l14 14-6 4Z M250 102l-14 14-4-6Z" fill="#4ac0e0"/>
        </g>
        <circle cx="250" cy="102" r="5" fill="#fff"/>
        <path d="M170 134v16M260 134v16" stroke="#0a2540" stroke-width="6"/>`,

    // Écri+ : cahier avec écriture qui se dessine
    ecrip: d => `
        <rect width="320" height="180" fill="#e6f6eb"/>
        <rect x="60" y="20" width="200" height="140" rx="6" fill="#fff" stroke="#cfe6d6" stroke-width="2"/>
        <path d="M84 20v140" stroke="#f2b8b2" stroke-width="2"/>
        <g stroke="#dbe7f3" stroke-width="2"><path d="M60 50h200M60 74h200M60 98h200M60 122h200M60 146h200"/></g>
        <path class="wii-write" d="M96 66c6-10 10-10 12 0s6 10 10 0 8-10 12 0 6 8 12-2 8 6 14 2c6-4 8 4 14 0M96 90c8-6 14 4 20-2s10 6 18 0 10 4 16-2" fill="none" stroke="#2a5db0" stroke-width="3" stroke-linecap="round"/>
        <g transform="translate(232 84)"><g class="wii-float">
            <circle r="30" fill="#2eaa5c"/>
            <text y="2" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="18" fill="#fff">${d.cardScore}</text>
            <text y="16" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="9" fill="#d9f5e2">points</text>
        </g></g>`,

    // Météo : ciel, soleil qui tourne, nuages qui dérivent, température
    meteo: () => `
        <defs><linearGradient id="wii-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4f5"/><stop offset="1" stop-color="#d4edfc"/></linearGradient></defs>
        <rect width="320" height="180" fill="url(#wii-sky)"/>
        <g class="wii-spin-slow" style="transform-origin:96px 70px">
            <g stroke="#ffd34d" stroke-width="6" stroke-linecap="round">
                <path d="M96 22v10M96 108v10M48 70h10M134 70h10M62 36l7 7M123 97l7 7M62 104l7-7M123 43l7-7"/>
            </g>
        </g>
        <circle cx="96" cy="70" r="28" fill="#ffc21a"/>
        <g class="wii-drift"><path d="M150 96a16 16 0 0 1 4-31 22 22 0 0 1 41-4 16 16 0 0 1 9 35Z" fill="#fff"/></g>
        <g class="wii-drift wii-delay" opacity=".85"><path d="M40 150a12 12 0 0 1 3-23 16 16 0 0 1 30-3 12 12 0 0 1 7 26Z" fill="#fff"/></g>`,

    // Statistiques : graphique qui se construit
    stats: () => `
        <rect width="320" height="180" fill="#e2f6fb"/>
        <g stroke="#c4e6ef" stroke-width="2"><path d="M40 40h250M40 75h250M40 110h250"/></g>
        <path d="M40 145h250" stroke="#5b6270" stroke-width="4" stroke-linecap="round"/>
        <g class="wii-bars">
            <rect x="56" y="100" width="26" height="45" rx="4" fill="#9fdcec"/>
            <rect x="96" y="76" width="26" height="69" rx="4" fill="#22a6c8"/>
            <rect x="136" y="90" width="26" height="55" rx="4" fill="#9fdcec"/>
            <rect x="176" y="56" width="26" height="89" rx="4" fill="#22a6c8"/>
            <rect x="216" y="70" width="26" height="75" rx="4" fill="#9fdcec"/>
            <rect x="256" y="36" width="26" height="109" rx="4" fill="#1a7f9c"/>
        </g>
        <polyline class="wii-write" points="69,92 109,68 149,82 189,48 229,62 269,28" fill="none" stroke="#f2a516" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
};

// Config des chaînes redessinées, clé = title FR
const WII_CARDS = {
    'Profil Pro':       { scene: 'profil' },
    'BUT Informatique': { scene: 'but' },
    'Culture':          { scene: 'culture' },
    'Arduino':          { scene: 'arduino' },
    'Projet Jeu':       { scene: 'jeu' },
    'Récompenses':      { scene: 'awards' },
    'Stage':            { scene: 'stage' },
    'Alternance':       { scene: 'alternance' },
    'Écri+':            { scene: 'ecrip' },
    'Météo':            { scene: 'meteo', extra: '<div class="wii-temp" id="meteo-card-sub">--°C</div>' },
    'Statistiques':     { scene: 'stats' },
};

function wiiCardShell(data, extraClass) {
    const div = document.createElement('div');
    div.className = 'channel ' + extraClass;
    div._channelData = data;
    div.onclick = () => zoomChannel(div);
    div.setAttribute('role', 'button');
    div.tabIndex = 0;
    div.setAttribute('aria-label', (currentLang === 'en' && data.titleEn) ? data.titleEn : data.title);
    return div;
}

function createWiiCard(data) {
    const cfg = WII_CARDS[data.title];
    if (!cfg) return null;
    const label = (currentLang === 'en' && data.cardLabelEn) ? data.cardLabelEn : (data.cardLabel || data.title);
    const div = wiiCardShell(data, 'wii-card wii-card--' + cfg.scene);
    div.innerHTML = `
        <div class="channel-inner wii-card-inner">
            <svg class="wii-scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${WII_SCENES[cfg.scene](data)}</svg>
            ${cfg.extra || ''}
            <div class="wii-photo-band">${label}</div>
        </div>`;
    return div;
}

// Cartes photo (Moi, IHM) : même bandeau titre que les scènes
function createWiiPhotoCard(data, imgSrc, label, extraClass = '') {
    const div = wiiCardShell(data, 'wii-photo ' + extraClass);
    div.innerHTML = `
        <div class="channel-inner">
            <img src="${imgSrc}" class="ch-bg" alt="">
            <div class="wii-photo-band">${label}</div>
        </div>`;
    return div;
}
