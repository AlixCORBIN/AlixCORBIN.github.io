/* =========================================
   MOBILE : swipe entre les pages et dans l'overlay,
   points de pagination, texte d'intro adapté au tactile.
   ========================================= */
(function () {
    const isTouch = window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;

    // Texte d'intro : "Touchez" au lieu de "Cliquer"
    if (isTouch) {
        T.fr['intro.click'] = 'Touchez pour continuer';
        T.en['intro.click'] = 'Tap to continue';
        applyTranslations(currentLang);
        document.body.classList.add('is-touch');
    }

    // Hauteur réelle du footer (titre compris) pour caler la grille au-dessus
    function measureFooter() {
        const f = document.getElementById('main-footer');
        const t = document.querySelector('.portfolio-title');
        let top = f ? f.getBoundingClientRect().top : innerHeight - 120;
        if (t && t.offsetParent) top = Math.min(top, t.getBoundingClientRect().top);
        document.body.style.setProperty('--fh', Math.round(innerHeight - top) + 'px');
    }
    measureFooter();
    window.addEventListener('resize', measureFooter);

    // Points de pagination sous la grille
    const dots = document.createElement('div');
    dots.id = 'page-dots';
    document.body.appendChild(dots);
    function updateDots() {
        const n = activePAGES.length - 1; // la dernière page est vide, on ne la compte pas
        dots.innerHTML = '';
        for (let i = 0; i < n; i++) {
            const d = document.createElement('button');
            d.className = 'page-dot' + (i === currentPage ? ' on' : '');
            d.setAttribute('aria-label', 'Page ' + (i + 1));
            d.onclick = () => navigatePage(i - currentPage);
            dots.appendChild(d);
        }
    }
    const _navigatePage = navigatePage;
    navigatePage = function (dir) { _navigatePage(dir); updateDots(); };
    const _renderGrid = renderGrid;
    renderGrid = function () { _renderGrid(); updateDots(); };
    updateDots();
    // Points visibles seulement quand la grille est affichée (pas sur l'intro ni l'overlay)
    const gw = document.getElementById('grid-wrapper');
    const ov = document.getElementById('full-overlay');
    function syncDots() {
        const show = gw.classList.contains('grid-visible') && ov.style.display !== 'flex';
        dots.style.opacity = show ? '1' : '0';
    }
    new MutationObserver(syncDots).observe(gw, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(syncDots).observe(ov, { attributes: true, attributeFilter: ['style'] });
    syncDots();

    // Swipe horizontal générique
    function onSwipe(el, cb) {
        let x0 = null, y0 = null;
        el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
        el.addEventListener('touchend', e => {
            if (x0 === null) return;
            const dx = e.changedTouches[0].clientX - x0;
            const dy = e.changedTouches[0].clientY - y0;
            x0 = null;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) cb(dx < 0 ? 1 : -1);
        }, { passive: true });
    }
    onSwipe(document.getElementById('grid-wrapper'), dir => {
        // pas de swipe vers la page vide de fin
        if (dir > 0 && currentPage >= activePAGES.length - 2) return;
        navigatePage(dir);
    });
    onSwipe(document.getElementById('full-overlay'), dir => {
        if (overlay.classList.contains('active')) navigate(dir);
    });
})();
