/* ══════════════════════════════════════
   Stage page — script.js
   ══════════════════════════════════════ */

const CANDIDATURES = [
    { statut: 'Refusé',    entreprise: 'Group Numains LAVAL',               poste: 'Candidature libre',                               date: '21/11/2025', source: 'Contact' },
    { statut: 'Refusé',    entreprise: 'Covéa',                             poste: 'Candidature libre',                               date: '23/11/2025', source: 'Contact' },
    { statut: 'Refusé',    entreprise: 'Alphacan',                          poste: 'Candidature libre',                               date: '03/12/2025', source: 'Contact' },
    { statut: 'En attente',entreprise: 'Babasport',                         poste: 'Full Stack Developer',                            date: '12/12/2025', source: 'Indeed' },
    { statut: 'Refusé',    entreprise: 'Vinci Énergie',                     poste: 'Candidature libre',                               date: '15/12/2025', source: 'Contact' },
    { statut: 'Refusé',    entreprise: 'LDC',                               poste: 'Candidature libre',                               date: '16/12/2025', source: 'Contact' },
    { statut: 'Refusé',    entreprise: 'Salesky',                           poste: 'Candidature libre',                               date: '16/12/2025', source: 'Contact' },
    { statut: 'Refusé',    entreprise: 'Pôle Santé Sarthe et Loir',         poste: 'Candidature libre',                               date: '16/12/2025', source: 'Contact' },
    { statut: 'Refusé',    entreprise: 'Mairie de Sablé / Pays Sabolien',   poste: 'Candidature libre',                               date: '16/12/2025', source: 'Contact' },
    { statut: 'Refusé',    entreprise: 'CLASS',                             poste: 'Candidature libre',                               date: '16/12/2025', source: 'Contact' },
    { statut: 'En attente',entreprise: 'Mors Smitt (Wabtec)',               poste: 'Candidature libre',                               date: '16/12/2025', source: 'Contact' },
    { statut: 'Refusé',    entreprise: 'Vinci Énergie',                     poste: 'Annonce supprimée',                               date: '26/12/2025', source: 'Indeed' },
    { statut: 'Refusé',    entreprise: 'Deenova',                           poste: 'Technicien hotline automatisme',                   date: '01/01/2026', source: 'Indeed' },
    { statut: 'En attente',entreprise: 'idIA Tech',                         poste: 'Développeur Java & Web-Mining',                   date: '05/01/2026', source: 'LinkedIn' },
    { statut: 'En attente',entreprise: 'Deus Sport',                        poste: 'Développeur Web (Symfony)',                        date: '21/01/2026', source: 'HelloWork' },
    { statut: 'En attente',entreprise: 'Shiftify',                          poste: 'Designer / Développeur Front-End',                 date: '21/01/2026', source: 'LinkedIn' },
    { statut: 'En attente',entreprise: 'Shiftify',                          poste: 'Développeur Back-End',                            date: '21/01/2026', source: 'LinkedIn' },
    { statut: 'Refusé',    entreprise: 'Vinci Énergie',                     poste: 'STAGE – Chef de projet Data & IA',                date: '22/01/2026', source: 'LinkedIn' },
    { statut: 'En attente',entreprise: 'Axians',                            poste: 'Candidature libre',                               date: '22/01/2026', source: 'Contact' },
    { statut: 'Accepté',   entreprise: 'Faure Herman',                      poste: 'Stagiaire développement logiciel H/F',            date: '25/01/2026', source: 'HelloWork' },
    { statut: 'Refusé',    entreprise: 'Voodoo',                            poste: 'Students & Graduates – Open Application',         date: '26/01/2026', source: 'LinkedIn' },
    { statut: 'Refusé',    entreprise: 'SERAC',                             poste: 'Candidature libre',                               date: '29/01/2026', source: 'Contact' },
    { statut: 'En attente',entreprise: 'Covéa',                             poste: 'Stage – Dév. Application Mobile Android/iOS',     date: '29/01/2026', source: 'HelloWork' },
    { statut: 'En attente',entreprise: 'Covéa',                             poste: 'Stage – Dév. Application Mobile Android',         date: '29/01/2026', source: 'HelloWork' },
    { statut: 'Refusé',    entreprise: 'STMicroelectronics',                poste: 'STAGE – Développement Logiciel Outils Innovants',  date: '30/01/2026', source: 'LinkedIn' },
    { statut: 'En attente',entreprise: 'Groupe OKWIND',                     poste: 'Stage – Développeur Full Stack',                  date: '31/01/2026', source: 'LinkedIn' },
];

const ALTERNANCES = [
    { statut: 'En attente', entreprise: 'CLAAS', poste: 'BAC +2/3 – Alternance Développement Informatique', date: '07/03/2026', source: 'LinkedIn' },
];

/* ── Lang ── */
let currentLang = localStorage.getItem('lang') || 'fr';

function t(key) {
    const tr = window.PAGE_TRANSLATIONS;
    return (tr && tr[currentLang] && tr[currentLang][key]) || key;
}

/* ── Status helpers ── */
function statusClass(s) {
    if (s === 'Refusé')    return 'refused';
    if (s === 'En attente') return 'pending';
    if (s === 'Accepté')   return 'accepted';
    return 'pending';
}

function statusLabel(s) {
    if (s === 'Refusé')    return t('status.refused');
    if (s === 'En attente') return t('status.pending');
    if (s === 'Accepté')   return t('status.accepted');
    return s;
}

function statusDot(s) {
    if (s === 'Refusé')    return '✕';
    if (s === 'En attente') return '○';
    if (s === 'Accepté')   return '✓';
    return '·';
}

/* ── Render table ── */
function renderTable(data, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = data.map(row => `
        <tr class="${row.statut === 'Accepté' ? 'row-accepted' : ''}">
            <td><span class="status-badge ${statusClass(row.statut)}">${statusDot(row.statut)} ${statusLabel(row.statut)}</span></td>
            <td class="td-company">${row.entreprise}</td>
            <td class="td-poste">${row.poste}</td>
            <td class="td-date">${row.date}</td>
        </tr>`).join('');
}

/* ── Filter ── */
let currentFilter = 'all';

function filterTable(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    const tbody = document.getElementById('cand-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach((tr, i) => {
        const statut = CANDIDATURES[i]?.statut;
        const visible = filter === 'all' || statut === filter;
        tr.classList.toggle('hidden-row', !visible);
    });
}

/* ── setLanguage (called by lang-switcher) ── */
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (window.PAGE_TRANSLATIONS && window.PAGE_TRANSLATIONS[lang] && window.PAGE_TRANSLATIONS[lang][key] !== undefined) {
            el.innerHTML = window.PAGE_TRANSLATIONS[lang][key];
        }
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('lang-active', btn.dataset.lang === lang);
    });
    // Re-render tables with new lang
    renderTable(CANDIDATURES, 'cand-tbody');
    renderTable(ALTERNANCES,  'alt-tbody');
    filterTable(currentFilter);
}

/* ── Init ── */
(function init() {
    const savedLang = localStorage.getItem('lang') || 'fr';
    if (savedLang !== 'fr') {
        currentLang = savedLang;
    }
    renderTable(CANDIDATURES, 'cand-tbody');
    renderTable(ALTERNANCES,  'alt-tbody');
})();
