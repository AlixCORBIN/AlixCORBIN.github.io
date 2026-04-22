/* =============================================
   WII FOOTER — Shared component for sub-pages
   ============================================= */
(function () {
    /* ── Détection profondeur ── */
    const parts  = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const depth  = parts.length;
    const base   = depth <= 1 ? 'assets/' : '../assets/';

    /* ── Dark mode (appliquer depuis localStorage) ── */
    if (localStorage.getItem('darkMode') === '1') {
        document.body.classList.add('dark-mode');
    }

    /* ── Lang ── */
    const lang = localStorage.getItem('lang') || 'fr';
    const TX = {
        fr: { title: 'Portfolio Alix CORBIN', role: 'Étudiant BUT Informatique — Laval' },
        en: { title: "Alix CORBIN's Portfolio",  role: 'Computer Science Student — Laval' }
    };
    function t(k) { return (TX[lang] || TX.fr)[k]; }

    /* ── Injecter le footer HTML ── */
    const footer = document.createElement('div');
    footer.id = 'wii-footer';
    footer.innerHTML = `
        <div class="footer-bg">
            <svg width="100%" height="100%" viewBox="0 0 1000 140" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="wfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%"   style="stop-color:#dcdcdc;stop-opacity:1"/>
                        <stop offset="100%" style="stop-color:#f0f0f0;stop-opacity:1"/>
                    </linearGradient>
                    <linearGradient id="wfGradDark" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%"   style="stop-color:#1a1a2e;stop-opacity:1"/>
                        <stop offset="100%" style="stop-color:#0e1018;stop-opacity:1"/>
                    </linearGradient>
                </defs>
                <path d="M0,140 L0,0 L200,0 Q300,0 350,30 L650,30 Q700,0 800,0 L1000,0 L1000,140 Z"
                      fill="url(#wfGrad)" stroke="#4ac0e0" stroke-width="4"/>
            </svg>
        </div>

        <!-- Bouton Wii (dark mode) -->
        <div class="wii-btn-wrapper left-btn" id="wf-dark-btn" style="cursor:pointer">
            <div class="glass-btn"><span class="btn-text">Wii</span></div>
        </div>

        <!-- Bouton musique -->
        <div class="music-btn" id="wf-music-btn">
            <svg id="wf-music-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
            </svg>
            <svg id="wf-music-icon-muted" viewBox="0 0 24 24" fill="currentColor" style="display:none">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" opacity="0.3"/>
                <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
        </div>

        <!-- Zone horloge -->
        <div class="clock-area">
            <div class="portfolio-title" id="wf-title">${t('title')}</div>
            <div class="digital-time">
                <span id="wf-h">12</span><span style="animation:blink 1s infinite">:</span><span id="wf-m">00</span>
            </div>
            <div class="date-text" id="wf-date">--/--</div>
        </div>

        <!-- Bouton contact -->
        <div class="wii-btn-wrapper right-btn" id="wf-contact-btn" style="cursor:pointer">
            <div class="glass-btn">
                <svg class="btn-icon" viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
            </div>
        </div>
    `;
    document.body.appendChild(footer);

    /* ── Modal contact ── */
    const modal = document.createElement('div');
    modal.id = 'contact-modal';
    modal.innerHTML = `
        <div class="contact-card" id="wf-contact-card">
            <button class="contact-close" id="wf-close-btn">✕</button>
            <div class="contact-header">
                <img src="${base}maphoto.png" class="contact-avatar" alt="Alix Corbin">
                <div>
                    <div class="contact-name">Alix Corbin</div>
                    <div class="contact-role" id="wf-contact-role">${t('role')}</div>
                </div>
            </div>
            <div class="contact-items">
                <a class="contact-item" href="mailto:alix.corbin.pro@gmail.com">
                    <span class="contact-item-icon">✉️</span>
                    <span>alix.corbin.pro@gmail.com</span>
                </a>
                <a class="contact-item" href="tel:+33768658968">
                    <span class="contact-item-icon">📱</span>
                    <span>07 68 65 89 68</span>
                </a>
                <div class="contact-item">
                    <span class="contact-item-icon">📍</span>
                    <span>Laval &mdash; Le Mans / Sablé / La Flèche</span>
                </div>
                <a class="contact-item" href="https://alixcorbin.github.io/" target="_blank">
                    <span class="contact-item-icon">🔗</span>
                    <span>alixcorbin.github.io</span>
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    /* ── Audio ── */
    const audio = document.createElement('audio');
    audio.loop = true;
    audio.innerHTML = `<source src="${base}WiiMenuMusic.mp3" type="audio/mp3">`;
    document.body.appendChild(audio);
    let musicMuted = false;

    /* ── Horloge ── */
    const daysFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function updateClock() {
        const now  = new Date();
        const days = (localStorage.getItem('lang') || 'fr') === 'en' ? daysEn : daysFr;
        const hEl  = document.getElementById('wf-h');
        const mEl  = document.getElementById('wf-m');
        const dEl  = document.getElementById('wf-date');
        if (hEl) hEl.textContent = now.getHours();
        if (mEl) mEl.textContent = String(now.getMinutes()).padStart(2, '0');
        if (dEl) dEl.textContent = `${days[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    /* ── Dark mode toggle ── */
    window.wfToggleDarkMode = function () {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark ? '1' : '0');
        // Tracking Supabase si disponible sur la page (ex: stats)
        if (typeof sbPost === 'function') sbPost('increment_preference', { p_event: isDark ? 'dark_mode_on' : 'dark_mode_off' });
    };
    document.getElementById('wf-dark-btn').addEventListener('click', window.wfToggleDarkMode);

    /* ── Musique ── */
    window.wfToggleMusic = function () {
        musicMuted = !musicMuted;
        const iconOn  = document.getElementById('wf-music-icon');
        const iconOff = document.getElementById('wf-music-icon-muted');
        const btn     = document.getElementById('wf-music-btn');
        if (musicMuted) {
            audio.pause();
            if (iconOn)  iconOn.style.display  = 'none';
            if (iconOff) iconOff.style.display = 'block';
            if (btn) btn.classList.add('music-muted');
        } else {
            audio.play().catch(() => {});
            if (iconOn)  iconOn.style.display  = 'block';
            if (iconOff) iconOff.style.display = 'none';
            if (btn) btn.classList.remove('music-muted');
        }
        if (typeof sbPost === 'function') sbPost('increment_preference', { p_event: musicMuted ? 'music_muted' : 'music_unmuted' });
    };
    document.getElementById('wf-music-btn').addEventListener('click', window.wfToggleMusic);

    /* ── Contact modal ── */
    window.wfOpenContact = function () {
        document.getElementById('contact-modal').classList.add('contact-visible');
    };
    window.wfCloseContact = function () {
        document.getElementById('contact-modal').classList.remove('contact-visible');
    };
    document.getElementById('wf-contact-btn').addEventListener('click', window.wfOpenContact);
    document.getElementById('wf-close-btn').addEventListener('click', window.wfCloseContact);
    document.getElementById('contact-modal').addEventListener('click', function (e) {
        if (e.target === this) window.wfCloseContact();
    });

    /* ── Synchro langue (appelée depuis lang-switcher.js) ── */
    // On surcharge setLanguage si elle existe (rajout après l'appel original)
    const _origSetLang = window.setLanguage;
    window.setLanguage = function (l) {
        if (_origSetLang) _origSetLang(l);
        const titleEl = document.getElementById('wf-title');
        const roleEl  = document.getElementById('wf-contact-role');
        if (titleEl) titleEl.textContent = (TX[l] || TX.fr).title;
        if (roleEl)  roleEl.textContent  = (TX[l] || TX.fr).role;
        updateClock(); // recharge les noms de jours
    };

    /* ── Ajouter du padding-bottom aux pages pour ne pas être caché par le footer ── */
    const style = document.createElement('style');
    style.textContent = 'body { padding-bottom: 140px; } @media(max-width:768px){body{padding-bottom:110px;}} @media(max-width:480px){body{padding-bottom:96px;}}';
    document.head.appendChild(style);

    /* ── Fondu au noir — transition entre pages ── */
    const fadeEl = document.createElement('div');
    fadeEl.id = 'wf-page-fade';
    fadeEl.style.cssText = [
        'position:fixed', 'inset:0', 'background:#000',
        'opacity:1', 'pointer-events:none',
        'transition:opacity 0.5s ease',
        'z-index:99999'
    ].join(';');
    document.body.appendChild(fadeEl);

    // Fade-in : la page apparaît depuis le noir
    requestAnimationFrame(() => {
        requestAnimationFrame(() => { fadeEl.style.opacity = '0'; });
    });

    // Intercepter le bouton "← Portfolio" pour faire un fondu avant de quitter
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.back-btn');
        if (!btn || !btn.href) return;
        e.preventDefault();
        const dest = btn.href;
        fadeEl.style.pointerEvents = 'all';
        fadeEl.style.opacity = '1';
        setTimeout(() => { window.location.href = dest; }, 550);
    });

})();
