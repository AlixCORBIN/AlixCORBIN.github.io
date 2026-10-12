// Chat général de la salle de jeux (hub Casino + tous les jeux, Monopoly compris).
// Script autonome : historique dans la table Supabase `global_chat`, direct via Realtime (broadcast + présence).
// Dans le hub, il s'affiche dans #gchat-dock ; ailleurs, bouton flottant pour l'ouvrir.
(function () {
  if (window.__gchat) return
  window.__gchat = true

  var URL_ = 'https://njkbhgmwylletmdmsmyl.supabase.co'
  var KEY = 'sb_publishable_VYQeM9TBjjoqs4CeAT06mQ_1AJ4uf7p'
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
  var MAX = 300
  var OPEN_KEY = 'gchat-open'

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch (e) { return null } }
  function guestName() {
    var n = null
    try { n = sessionStorage.getItem('gchat-guest') } catch (e) {}
    if (!n) { n = 'Invité ' + Math.floor(1000 + Math.random() * 9000); try { sessionStorage.setItem('gchat-guest', n) } catch (e) {} }
    return n
  }
  function myName() {
    var n = ''
    try { n = (JSON.parse(store('casino3d-wallet') || 'null') || {}).name || '' } catch (e) {}
    if (!n) n = new URLSearchParams(location.search).get('name') || ''
    if (!n) n = store('mono-name') || ''
    var input = document.querySelector('.c-name input')
    if (input && input.value.trim()) n = input.value
    if (!n && input && input.placeholder && input.placeholder !== 'Joueur') n = input.placeholder
    n = (n || '').trim().slice(0, 20)
    return n || guestName()
  }

  // ---------- interface ----------
  var css = document.createElement('style')
  css.textContent = [
    '.gchat{display:flex;flex-direction:column;min-height:0;font:14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f4efe2}',
    '.gchat-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
    '.gchat-head h2{font:700 17px Georgia,serif;margin:0;flex:1}',
    '.gchat-online{font-size:11px;opacity:.75;display:flex;align-items:center;gap:5px;cursor:default}',
    '.gchat-online i{width:8px;height:8px;border-radius:50%;background:#ffb870}',
    '.gchat-online.ok i{background:#6be28f;box-shadow:0 0 8px #6be28f}',
    '.gchat-x{background:none;border:0;color:inherit;font-size:18px;line-height:1;padding:2px 4px;cursor:pointer;opacity:.7}',
    '.gchat-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-right:2px;overscroll-behavior:contain}',
    '.gchat-msg{padding:4px 8px;border-radius:8px;background:rgba(232,196,104,.08);border-left:3px solid rgba(232,196,104,.5);word-wrap:break-word;line-height:1.35}',
    '.gchat-msg b{color:#e8c468;margin-right:5px}',
    '.gchat-msg.me{border-left-color:#6be28f}.gchat-msg.me b{color:#6be28f}',
    '.gchat-msg time{float:right;font-size:10px;opacity:.45;margin-left:6px}',
    '.gchat-empty{opacity:.6;text-align:center;font-size:13px;margin:auto 0}',
    '.gchat-form{display:flex;gap:6px;margin-top:8px}',
    '.gchat-form input{flex:1;min-width:0;margin:0;padding:8px 10px;font-size:14px;border-radius:10px;border:1px solid rgba(232,196,104,.28);background:rgba(0,0,0,.35);color:inherit}',
    '.gchat-form button{flex:none;padding:8px 12px;border-radius:10px;border:1px solid #f5dc92;background:linear-gradient(180deg,#f0d27f,#c99b3c);color:#231703;font-weight:700;cursor:pointer}',
    '.gchat-form button:disabled{opacity:.5;cursor:default}',
    '.gchat-dock{height:300px;display:flex;flex-direction:column}',
    '.gchat-dock .gchat{flex:1}',
    '.gchat-float{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:900;display:flex;flex-direction:column;align-items:flex-start;gap:8px;pointer-events:none}',
    '.gchat-float>*{pointer-events:auto}',
    '.gchat-float .gchat{width:min(320px,calc(100vw - 24px));height:min(340px,55vh);padding:12px;border-radius:16px;border:1px solid rgba(232,196,104,.28);background:rgba(8,24,17,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 20px 50px rgba(0,0,0,.6)}',
    '.gchat-btn{position:relative;display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1px solid rgba(232,196,104,.45);background:rgba(0,0,0,.7);color:#f4efe2;font:600 13px system-ui,sans-serif;cursor:pointer}',
    '.gchat-btn.on{border-color:#e8c468;background:rgba(232,196,104,.2)}',
    '.gchat-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#d33a3a;color:#fff;font-size:11px;display:grid;place-items:center}',
    '.gchat-badge[hidden]{display:none}',
    '@media (max-width:600px){.gchat-btn span.lbl{display:none}}'
  ].join('\n')
  document.head.appendChild(css)

  var panel = document.createElement('div')
  panel.className = 'gchat'
  panel.innerHTML =
    '<div class="gchat-head"><h2>Chat général</h2><span class="gchat-online"><i></i><span>connexion…</span></span><button class="gchat-x" title="Fermer" aria-label="Fermer">×</button></div>' +
    '<div class="gchat-list" aria-live="polite"><p class="gchat-empty">Personne n’a encore écrit. Lance la conversation !</p></div>' +
    '<form class="gchat-form"><input maxlength="' + MAX + '" placeholder="Écrire à tout le monde…" aria-label="Message"><button type="submit">Envoyer</button></form>'
  var list = panel.querySelector('.gchat-list')
  var form = panel.querySelector('form')
  var input = form.querySelector('input')
  var sendBtn = form.querySelector('button')
  var online = panel.querySelector('.gchat-online')
  var closeBtn = panel.querySelector('.gchat-x')

  var float = document.createElement('div')
  float.className = 'gchat-float'
  var btn = document.createElement('button')
  btn.className = 'gchat-btn'
  btn.title = 'Chat général'
  btn.innerHTML = '💬 <span class="lbl">Chat général</span><span class="gchat-badge" hidden></span>'
  var badge = btn.querySelector('.gchat-badge')
  float.appendChild(btn)

  // les touches tapées dans le chat ne doivent pas piloter le jeu
  ;['keydown', 'keyup', 'keypress'].forEach(function (t) { input.addEventListener(t, function (e) { e.stopPropagation() }) })

  var open = store(OPEN_KEY) === '1'
  var docked = false
  var unread = 0
  function visible() { return docked || open }
  function setUnread(n) { unread = n; badge.hidden = !n; badge.textContent = n > 9 ? '9+' : String(n) }
  function layout() {
    var dock = document.getElementById('gchat-dock')
    docked = !!dock
    if (dock) {
      if (panel.parentNode !== dock) dock.appendChild(panel)
      if (float.parentNode) float.remove()
      closeBtn.hidden = true
    } else {
      if (!float.parentNode) document.body.appendChild(float)
      closeBtn.hidden = false
      if (open && panel.parentNode !== float) float.insertBefore(panel, btn)
      if (!open && panel.parentNode) panel.remove()
      btn.classList.toggle('on', open)
    }
    if (visible()) { setUnread(0); scrollDown() }
  }
  function toggle(v) { open = v; store(OPEN_KEY, v ? '1' : '0'); layout(); if (v) input.focus() }
  btn.onclick = function () { toggle(!open) }
  closeBtn.onclick = function () { toggle(false) }

  // ---------- messages ----------
  var seen = {}
  function scrollDown() { list.scrollTop = list.scrollHeight }
  function hhmm(d) { return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  function add(m, fromHistory) {
    if (!m || !m.msg || seen[m.key]) return
    seen[m.key] = true
    var empty = list.querySelector('.gchat-empty')
    if (empty) empty.remove()
    var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40
    var el = document.createElement('div')
    el.className = 'gchat-msg' + (m.name === myName() ? ' me' : '')
    var t = document.createElement('time'); t.textContent = hhmm(new Date(m.at || Date.now()))
    var b = document.createElement('b'); b.textContent = m.name
    el.appendChild(t); el.appendChild(b); el.appendChild(document.createTextNode(m.msg))
    list.appendChild(el)
    while (list.children.length > 150) list.firstChild.remove()
    if (atBottom || fromHistory) scrollDown()
    if (!fromHistory && !visible()) setUnread(unread + 1)
  }

  var client = null, channel = null, last = 0
  form.onsubmit = function (e) {
    e.preventDefault()
    var msg = input.value.trim().slice(0, MAX)
    if (!msg || !channel || Date.now() - last < 1000) return
    last = Date.now()
    var m = { key: Math.random().toString(36).slice(2) + last, name: myName(), msg: msg, at: new Date().toISOString() }
    input.value = ''
    add(m)
    channel.send({ type: 'broadcast', event: 'msg', payload: m })
    client.from('global_chat').insert({ name: m.name, msg: m.msg }).then(function () {})
  }

  function start() {
    client = window.supabase.createClient(URL_, KEY, { auth: { persistSession: false } })
    client.from('global_chat').select('id,name,msg,created_at').order('id', { ascending: false }).limit(60).then(function (r) {
      ;(r.data || []).reverse().forEach(function (row) { add({ key: 'db' + row.id, name: row.name, msg: row.msg, at: row.created_at }, true) })
    })
    var me = Math.random().toString(36).slice(2)
    channel = client.channel('casino-global-chat', { config: { broadcast: { self: false }, presence: { key: me } } })
    channel.on('broadcast', { event: 'msg' }, function (p) { add(p.payload) })
    channel.on('presence', { event: 'sync' }, function () {
      var st = channel.presenceState(), names = []
      Object.keys(st).forEach(function (k) { if (st[k][0]) names.push(st[k][0].name) })
      online.classList.add('ok')
      online.lastChild.textContent = names.length + ' en ligne'
      online.title = names.join(', ')
    })
    channel.subscribe(function (s) {
      if (s === 'SUBSCRIBED') channel.track({ name: myName() })
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { online.classList.remove('ok'); online.lastChild.textContent = 'hors ligne' }
    })
    // met à jour le nom affiché dans la présence si le joueur change de pseudo
    var lastName = myName()
    setInterval(function () { var n = myName(); if (n !== lastName) { lastName = n; channel.track({ name: n }) } }, 3000)
  }

  function boot() {
    layout()
    new MutationObserver(function () {
      var hasDock = !!document.getElementById('gchat-dock')
      if (hasDock !== docked || (hasDock && !document.getElementById('gchat-dock').contains(panel))) layout()
    }).observe(document.body, { childList: true, subtree: true })
    if (window.supabase && window.supabase.createClient) return start()
    var s = document.createElement('script')
    s.src = LIB
    s.onload = start
    s.onerror = function () { online.lastChild.textContent = 'hors ligne'; sendBtn.disabled = true }
    document.head.appendChild(s)
  }
  if (document.body) boot()
  else document.addEventListener('DOMContentLoaded', boot)
})()
