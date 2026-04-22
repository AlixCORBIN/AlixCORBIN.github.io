/* ============================================
   LANG SWITCHER — Script partagé (sous-pages)
   ============================================ */
(function () {
    // Chemin vers assets/ selon la profondeur de l'URL
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const A = depth <= 0 ? 'assets/' : depth === 1 ? '../assets/' : '../../assets/';

    // Langue courante
    function getLang() { return localStorage.getItem('lang') || 'fr'; }

    // Injecte le switcher HTML dans le body
    function injectSwitcher() {
        if (document.getElementById('lang-switcher')) return; // déjà présent
        const div = document.createElement('div');
        div.id = 'lang-switcher';
        div.innerHTML =
            '<button class="lang-btn" data-lang="fr" onclick="setLang(\'fr\')" title="Français">' +
                '<img src="' + A + 'France.jpg" alt="FR" class="flag-img">' +
            '</button>' +
            '<div class="lang-divider"></div>' +
            '<button class="lang-btn" data-lang="en" onclick="setLang(\'en\')" title="English">' +
                '<img src="' + A + 'UK.webp" alt="EN" class="flag-img">' +
            '</button>';
        document.body.appendChild(div);
        updateButtons(getLang());
    }

    // Met à jour l'état actif des boutons
    function updateButtons(lang) {
        document.querySelectorAll('#lang-switcher .lang-btn').forEach(function (btn) {
            btn.classList.toggle('lang-active', btn.dataset.lang === lang);
        });
    }

    // Applique les traductions via data-i18n
    function applyTranslations(lang) {
        var tr = window.PAGE_TRANSLATIONS;
        if (!tr || !tr[lang]) return;
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            if (tr[lang][key] !== undefined) el.innerHTML = tr[lang][key];
        });
        document.documentElement.lang = lang;
        // Titre de la page
        if (tr[lang]['page.title']) document.title = tr[lang]['page.title'];
        updateButtons(lang);
    }

    // Exposé globalement
    window.setLang = function (lang) {
        localStorage.setItem('lang', lang);
        applyTranslations(lang);
        // Synchronise aussi le switcher de la page principale si ouvert dans le même onglet
        if (window.setLanguage) window.setLanguage(lang);
    };

    // Init
    document.addEventListener('DOMContentLoaded', function () {
        injectSwitcher();
        applyTranslations(getLang());
    });
})();
