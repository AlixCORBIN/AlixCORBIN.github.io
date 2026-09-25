/* ══════════════════════════════════════
   Stats page — script.js
   ══════════════════════════════════════ */

let currentLang = localStorage.getItem('lang') || 'fr';

/* ── Texts (dynamic parts) ── */
const DYN = {
    fr: {
        noData: 'Aucune donnée',
        darkOn: '🌙 Dark mode activé',
        darkOff: '☀️ Dark mode désactivé',
        musicMuted: '🔇 Musique coupée',
        musicOn: '🎵 Musique activée',
        langFr: '🇫🇷 Langue FR',
        langEn: '🇬🇧 Langue EN',
        dayNames: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    },
    en: {
        noData: 'No data',
        darkOn: '🌙 Dark mode on',
        darkOff: '☀️ Dark mode off',
        musicMuted: '🔇 Music muted',
        musicOn: '🎵 Music on',
        langFr: '🇫🇷 French',
        langEn: '🇬🇧 English',
        dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    }
};

function d(key) {
    return (DYN[currentLang] || DYN.fr)[key];
}

// Échappe le HTML des valeurs venant de la base (pseudo, nom de chaîne...)
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── Fetch stats ── */
async function fetchLeaderboard() {
    const r = await sbFetch('rpc/get_blackjack_leaderboard', { body: '{}' });
    return r.json();
}

async function fetchStats() {
    const r = await sbFetch('rpc/get_stats_summary', { body: '{}' });
    return r.json();
}

/* ── Render visits ── */
function renderVisits(data) {
    const fmt = n => Number(n || 0).toLocaleString('fr-FR');
    setVal('val-total', fmt(data.total_visits));
    setVal('val-today', fmt(data.today_visits));
    setVal('val-week',  fmt(data.week_visits));
    setVal('val-month', fmt(data.month_visits));
}

/* ── Bar chart 7 jours ── */
function renderBarChart(dailyChart) {
    const el = document.getElementById('bar-chart');
    if (!el) return;

    // Build a map date→count for last 7 days
    const map = {};
    (dailyChart || []).forEach(row => { map[row.date] = row.count; });

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d);
    }

    const maxCount = Math.max(1, ...days.map(d => map[d.toISOString().slice(0, 10)] || 0));

    el.innerHTML = days.map(day => {
        const key   = day.toISOString().slice(0, 10);
        const count = map[key] || 0;
        const pct   = Math.round((count / maxCount) * 100);
        const label = DYN[currentLang].dayNames[day.getDay()];
        return `
            <div class="bar-col">
                <div class="bar-count">${count || ''}</div>
                <div class="bar-fill" style="height:${Math.max(pct, 2)}%"></div>
                <div class="bar-label">${label}</div>
            </div>`;
    }).join('');
}

/* ── Channel ranking ── */
function renderChannelRanking(clicks) {
    const el = document.getElementById('channel-ranking');
    if (!el) return;

    const list = (clicks || []).slice(0, 8);
    if (!list.length) { el.innerHTML = `<p style="color:var(--muted);font-size:.8rem">${d('noData')}</p>`; return; }

    const max = list[0].count;
    const medals = ['gold', 'silver', 'bronze'];

    el.innerHTML = list.map((item, i) => {
        const pct  = Math.round((item.count / max) * 100);
        const cls  = medals[i] || '';
        return `
            <div class="rank-item">
                <span class="rank-num ${cls}">${i + 1}</span>
                <span class="rank-name">${esc(item.channel)}</span>
                <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${pct}%"></div></div>
                <span class="rank-count">${Number(item.count) || 0}</span>
            </div>`;
    }).join('');
}

/* ── Prefs ── */
function renderPrefs(prefs) {
    const el = document.getElementById('prefs-list');
    if (!el) return;

    const map = {};
    (prefs || []).forEach(p => { map[p.event] = Number(p.count); });

    const darkTotal = (map['dark_mode_on'] || 0) + (map['dark_mode_off'] || 0);
    const musicTotal = (map['music_muted'] || 0) + (map['music_unmuted'] || 0);
    const langTotal = (map['lang_fr'] || 0) + (map['lang_en'] || 0);

    const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

    const rows = [
        {
            label: d('darkOn'),
            pct: pct(map['dark_mode_on'] || 0, darkTotal),
            color: 'purple',
            val: map['dark_mode_on'] || 0
        },
        {
            label: d('musicMuted'),
            pct: pct(map['music_muted'] || 0, musicTotal),
            color: 'cyan',
            val: map['music_muted'] || 0
        },
        {
            label: d('langEn'),
            pct: pct(map['lang_en'] || 0, langTotal),
            color: 'green',
            val: map['lang_en'] || 0
        }
    ];

    if (!darkTotal && !musicTotal && !langTotal) {
        el.innerHTML = `<p style="color:var(--muted);font-size:.8rem">${d('noData')}</p>`;
        return;
    }

    el.innerHTML = rows.map(row => `
        <div class="pref-item">
            <div class="pref-header">
                <span class="pref-label">${row.label}</span>
                <span class="pref-pct" style="color:var(--${row.color})">${row.pct}%</span>
            </div>
            <div class="pref-track"><div class="pref-fill ${row.color}" style="width:${row.pct}%"></div></div>
        </div>`).join('');
}

/* ── Leaderboard ── */
function renderLeaderboard(rows) {
    const el = document.getElementById('leaderboard-list');
    if (!el) return;
    if (!rows || !rows.length) {
        el.innerHTML = `<p style="color:var(--muted);font-size:.8rem;text-align:center">${d('lb.empty') || 'Aucune session.'}</p>`;
        return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    const colorBankroll = n => n >= 1000 ? 'var(--green)' : n >= 500 ? 'var(--orange)' : '#f87171';
    el.innerHTML = `
        <table class="lb-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>${d('lb.pseudo') || 'Pseudo'}</th>
                    <th>${d('lb.bankroll') || 'Solde'}</th>
                    <th>${d('lb.hands') || 'Mains'}</th>
                    <th>${d('lb.date') || 'Date'}</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row, i) => `
                    <tr class="${i < 3 ? 'lb-top' : ''}">
                        <td class="lb-rank">${medals[i] || (i + 1)}</td>
                        <td class="lb-pseudo">${esc(row.pseudo)}</td>
                        <td class="lb-bankroll" style="color:${colorBankroll(row.bankroll)}">${Number(row.bankroll).toLocaleString('fr-FR')} €</td>
                        <td class="lb-hands">${esc(row.hands)}</td>
                        <td class="lb-date">${esc(row.date)}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

/* ── Blackjack ── */
function renderBlackjack(data) {
    const sign = n => n > 0 ? `+${n}€` : `${n}€`;
    const color = n => n >= 0 ? 'var(--green)' : '#f87171';

    setVal('bj-sessions', Number(data.bj_sessions || 0).toLocaleString('fr-FR'));
    setVal('bj-hands',    Number(data.bj_total_hands || 0).toLocaleString('fr-FR'));
    setValColored('bj-avg',  sign(data.bj_avg_net  || 0), color(data.bj_avg_net  || 0));
    setValColored('bj-best', sign(data.bj_best  || 0), color(data.bj_best  || 0));
    const fmt = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    const dd = Number(data.bj_max_drawdown || 0);
    setValColored('bj-peak', `${fmt(data.bj_peak)}€`, 'var(--green)');
    setValColored('bj-drawdown', dd > 0 ? `-${fmt(dd)}€` : '0€', dd > 0 ? '#f87171' : 'var(--green)');
    setVal('bj-credit', `${fmt(data.bj_total_credit)}€`);
    setVal('bj-bj',  Number(data.bj_total_bj || 0).toLocaleString('fr-FR'));
}

/* ── Helpers ── */
function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.classList.remove('loading'); }
}

function setValColored(id, val, color) {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.style.color = color; el.classList.remove('loading'); }
}

function setLoading() {
    ['val-total','val-today','val-week','val-month',
     'bj-sessions','bj-hands','bj-avg','bj-best','bj-peak','bj-drawdown','bj-bj','bj-credit'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '—'; el.classList.add('loading'); }
    });
}

/* ── Language hook (appelé par assets/lang-switcher.js une fois les traductions appliquées) ── */
function setLanguage(lang) {
    currentLang = lang;
    // Re-render dynamic parts with new lang
    if (window._lastStats) {
        renderBarChart(window._lastStats.daily_chart);
        renderChannelRanking(window._lastStats.channel_clicks);
        renderPrefs(window._lastStats.preferences);
        renderLeaderboard(window._lastLb || []);
    }
}

/* ── Init ── */
async function init() {
    setLoading();

    // Apply initial lang from localStorage
    const savedLang = localStorage.getItem('lang') || 'fr';
    if (savedLang !== 'fr') setLanguage(savedLang);

    try {
        const [data, lb] = await Promise.all([fetchStats(), fetchLeaderboard()]);
        window._lastStats = data;
        window._lastLb    = lb;
        renderVisits(data);
        renderBarChart(data.daily_chart);
        renderChannelRanking(data.channel_clicks);
        renderPrefs(data.preferences);
        renderBlackjack(data);
        renderLeaderboard(Array.isArray(lb) ? lb : []);
    } catch (e) {
        console.error('Stats fetch error:', e);
        ['val-total','val-today','val-week','val-month'].forEach(id => setVal(id, '?'));
    }
}

init();
