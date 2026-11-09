/* ══════════════════════════════════════
   Stage page · script.js
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
    if (s === 'Refusé')    return '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.958 3.95801C18.4881 3.95763 19.0166 4.18846 19.4141 4.58594C19.8115 4.98342 20.0424 5.51194 20.042 6.04199C20.0423 6.57267 19.8115 7.06147 19.4141 7.41406C19.3082 7.50811 19.2025 7.60225 19.0967 7.69629C17.4824 9.13092 15.8673 10.5653 14.2529 12C15.8673 13.4347 17.4824 14.8691 19.0967 16.3037C19.2025 16.3978 19.3082 16.4919 19.4141 16.5859C19.8115 16.9385 20.0423 17.4273 20.042 17.958C20.0424 18.4881 19.8115 19.0166 19.4141 19.4141C19.0166 19.8115 18.4881 20.0424 17.958 20.042C17.4273 20.0423 16.9385 19.8115 16.5859 19.4141C16.4919 19.3082 16.3978 19.2025 16.3037 19.0967C14.8691 17.4824 13.4347 15.8673 12 14.2529C10.5653 15.8673 9.13092 17.4824 7.69629 19.0967C7.60225 19.2025 7.50811 19.3082 7.41406 19.4141C7.06147 19.8115 6.57267 20.0423 6.04199 20.042C5.51194 20.0424 4.98342 19.8115 4.58594 19.4141C4.18846 19.0166 3.95763 18.4881 3.95801 17.958C3.95773 17.4273 4.18854 16.9385 4.58594 16.5859C4.69176 16.4919 4.7975 16.3978 4.90332 16.3037C6.51743 14.8692 8.13186 13.4345 9.74609 12C8.13186 10.5655 6.51743 9.13076 4.90332 7.69629C4.7975 7.60225 4.69176 7.50811 4.58594 7.41406C4.18854 7.06147 3.95773 6.57267 3.95801 6.04199C3.95763 5.51194 4.18846 4.98342 4.58594 4.58594C4.98342 4.18846 5.51194 3.95763 6.04199 3.95801C6.57267 3.95773 7.06147 4.18854 7.41406 4.58594C7.50811 4.69176 7.60225 4.7975 7.69629 4.90332C9.13076 6.51743 10.5655 8.13186 12 9.74609C13.4345 8.13186 14.8692 6.51743 16.3037 4.90332C16.3978 4.7975 16.4919 4.69176 16.5859 4.58594C16.9385 4.18854 17.4273 3.95773 17.958 3.95801Z" fill="currentColor"/></svg></span>';
    if (s === 'En attente') return '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 3.00046C16.9706 3.00046 21 7.02989 21 12.0005C20.9998 16.9708 16.9704 21.0005 12 21.0005C7.02959 21.0005 3.00024 16.9708 3 12.0005C3 7.02989 7.02944 3.00046 12 3.00046ZM12 6.00046C11.4477 6.00046 11 6.44817 11 7.00046V10.9301C10.9998 11.2643 10.8327 11.5768 10.5547 11.7622L8.44531 13.1684C7.98595 13.4748 7.86166 14.0957 8.16797 14.5551C8.47435 15.0143 9.09528 15.1386 9.55469 14.8325L11.6641 13.4262C12.4985 12.8699 12.9998 11.933 13 10.9301V7.00046C13 6.44817 12.5523 6.00046 12 6.00046Z" fill="currentColor"/></svg></span>';
    if (s === 'Accepté')   return '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.9531 3.99225C19.48 3.9335 20.0214 4.09638 20.4492 4.43854C20.8769 4.78081 21.1545 5.27298 21.2129 5.79987C21.2716 6.32695 21.1064 6.84596 20.7617 7.24908C20.5953 7.44382 20.4282 7.63931 20.2617 7.83405C17.2647 11.3402 14.2675 14.8465 11.2705 18.3526C11.1041 18.5473 10.937 18.7428 10.7705 18.9376C10.52 19.23 10.1569 19.4123 9.76758 19.4493C9.50945 19.4735 9.25416 19.4313 9.02344 19.3311C8.84537 19.272 8.67957 19.1816 8.53906 19.0606C8.45329 18.9866 8.36702 18.9129 8.28125 18.8389C6.73535 17.5051 5.18946 16.1708 3.64356 14.837C3.55775 14.7629 3.47155 14.6884 3.38574 14.6143C2.98278 14.2673 2.74666 13.7828 2.74707 13.252C2.7467 12.7223 2.98292 12.1892 3.38574 11.7862C3.78869 11.3833 4.32181 11.1482 4.85156 11.1485C5.38243 11.148 5.86681 11.3832 6.21387 11.7862C6.28792 11.872 6.36247 11.9582 6.43652 12.044C7.4622 13.2328 8.48806 14.4216 9.51367 15.6104C12.0681 12.1955 14.6234 8.78117 17.1777 5.36627C17.3311 5.16129 17.4844 4.95602 17.6377 4.75104C17.9553 4.32607 18.426 4.05079 18.9531 3.99225Z" fill="currentColor"/></svg></span>';
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

/* ── setLanguage (hook appelé par assets/lang-switcher.js après application des traductions) ── */
function setLanguage(lang) {
    currentLang = lang;
    // Re-render tables with new lang
    renderTable(CANDIDATURES, 'cand-tbody');
    renderTable(ALTERNANCES,  'alt-tbody');
    filterTable(currentFilter);
}

/* ── Init ── */
// Attendre le DOM : PAGE_TRANSLATIONS est défini dans un script inline placé après celui-ci
// (sinon les statuts s'affichaient sous forme de clés brutes, ex. "status.refused")
document.addEventListener('DOMContentLoaded', function init() {
    const savedLang = localStorage.getItem('lang') || 'fr';
    currentLang = savedLang;
    renderTable(CANDIDATURES, 'cand-tbody');
    renderTable(ALTERNANCES,  'alt-tbody');
});
