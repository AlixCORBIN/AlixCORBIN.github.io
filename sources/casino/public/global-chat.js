// Chat général de la salle de jeux (hub Casino + tous les jeux, Monopoly compris).
// Script autonome : historique dans la table Supabase `global_chat`, direct via Realtime (broadcast + présence).
// Dans le hub, il s'affiche dans #gchat-dock ; ailleurs, bouton flottant pour l'ouvrir.
(function () {
  if (window.__gchat) return
  window.__gchat = true

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

  function myGame() {
    if (/\/monopoly\//.test(location.pathname)) return 'Monopoly 3D'
    try { return (window.__gchatGame && window.__gchatGame()) || null } catch (e) { return null }
  }

  // ---------- interface ----------
  var css = document.createElement('style')
  css.textContent = [
    '.gchat{display:flex;flex-direction:column;min-height:0;font:14px var(--ui,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);color:#f4efe2}',
    '.gchat-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
    '.gchat-head h2{font:600 17px var(--serif,Georgia,serif);margin:0;flex:1}',
    '.gchat-online{font-size:12px;opacity:.75;display:flex;align-items:center;gap:5px;cursor:default}',
    '.gchat-online i{width:8px;height:8px;border-radius:50%;background:#ffb870}',
    '.gchat-online.ok i{background:#6be28f;box-shadow:0 0 8px #6be28f}',
    '.gchat-x{background:none;border:0;color:inherit;font-size:18px;line-height:1;padding:2px 4px;cursor:pointer;opacity:.7}',
    '.gchat-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-right:2px;overscroll-behavior:contain}',
    '.gchat-msg{padding:4px 8px;border-radius:8px;background:rgba(232,196,104,.08);border-left:3px solid rgba(232,196,104,.5);word-wrap:break-word;line-height:1.35}',
    '.gchat-msg b{color:#e8c468;margin-right:5px}',
    '.gchat-msg b small{font-weight:400;opacity:.7;margin-left:4px}',
    '.gchat-msg.me{border-left-color:#6be28f}.gchat-msg.me b{color:#6be28f}',
    '.gchat-msg b.adm,.gchat-msg.me b.adm{color:#ff3b3b}',
    '.gchat-mod{float:right;display:none;gap:2px;margin-left:4px}.gchat-admin .gchat-msg:hover .gchat-mod{display:inline-flex}',
    '.gchat-mod button{background:none;border:0;padding:0 2px;cursor:pointer;font-size:12px;opacity:.75;color:inherit}.gchat-mod button:hover{opacity:1}',
    '.gchat-msg time{float:right;font-size:11px;opacity:.45;margin-left:6px}',
    '.gchat-empty{opacity:.6;text-align:center;font-size:13px;margin:auto 0}',
    '.gchat-form{display:flex;gap:6px;margin-top:8px}',
    '.gchat-form input{flex:1;min-width:0;margin:0;padding:8px 10px;font-size:14px;border-radius:10px;border:1px solid rgba(232,196,104,.28);background:rgba(0,0,0,.35);color:inherit}',
    '.gchat-form button{flex:none;padding:8px 14px;border-radius:10px;border:1px solid rgba(255,232,170,.9);background:linear-gradient(180deg,#f4d88f,#e2b85a 55%,#c9973c);color:#1d1404;font-weight:700;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}',
    '.gchat-form button:disabled{opacity:.5;cursor:default}',
    '.gchat-dock{height:300px;display:flex;flex-direction:column}',
    '.gchat-dock .gchat{flex:1}',
    '.gchat-float{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:900;display:flex;flex-direction:column;align-items:flex-start;gap:8px;pointer-events:none}',
    '.gchat-float>*{pointer-events:auto}',
    '.gchat-float .gchat{width:min(320px,calc(100vw - 24px));height:min(340px,55vh);padding:12px;border-radius:16px;border:1px solid rgba(232,196,104,.28);background:rgba(8,24,17,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 20px 50px rgba(0,0,0,.6)}',
    '.gchat-btn{position:relative;display:flex;align-items:center;gap:7px;height:38px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(7,15,12,.72);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 6px 18px rgba(0,0,0,.4);color:#f6f2e8;font:600 13px var(--ui,system-ui,sans-serif);cursor:pointer;transition:border-color .15s}',
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
    '<div class="gchat-list" aria-live="polite"><p class="gchat-empty">Personne n’a encore écrit. Lance la conversation</p></div>' +
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
  btn.innerHTML = '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.5003 3C12.9251 3 13.3309 3.00598 13.7181 3.01758C17.8214 3.14057 20.8588 6.17892 20.9817 10.2822C20.9933 10.6694 21.0003 11.0752 21.0003 11.5C21.0003 11.9248 20.9933 12.3306 20.9817 12.7178C20.8588 16.8211 17.8214 19.8594 13.7181 19.9824C13.3309 19.994 12.9251 20 12.5003 20C12.0754 20 11.6688 19.994 11.2815 19.9824C10.5767 19.9613 9.90317 19.8532 9.2708 19.6689C8.7758 19.525 8.1667 19.6887 7.68681 19.877C7.37512 19.9992 6.96512 20.1196 6.44169 20.2734C5.14068 20.6557 4.48998 20.8465 4.09404 20.5645C4.00374 20.5001 3.92405 20.4213 3.85966 20.3311C3.57739 19.9351 3.76928 19.2837 4.15166 17.9824C4.3002 17.4769 4.41786 17.0766 4.53544 16.7686C4.69208 16.3581 4.74954 15.867 4.58427 15.46C4.24483 14.6243 4.04735 13.7016 4.01787 12.7178C4.00627 12.3306 4.00029 11.9248 4.00029 11.5C4.00029 11.0752 4.00627 10.6694 4.01787 10.2822C4.14084 6.17899 7.17834 3.14066 11.2815 3.01758C11.6688 3.00597 12.0754 3 12.5003 3ZM7.50029 10.5C6.67186 10.5 6.00029 11.1716 6.00029 12C6.00029 12.8284 6.67186 13.5 7.50029 13.5C8.32857 13.4998 9.00029 12.8283 9.00029 12C9.00029 11.1717 8.32857 10.5002 7.50029 10.5ZM12.5003 10.5C11.6719 10.5 11.0003 11.1716 11.0003 12C11.0003 12.8284 11.6719 13.5 12.5003 13.5C13.3286 13.4998 14.0003 12.8283 14.0003 12C14.0003 11.1717 13.3286 10.5002 12.5003 10.5ZM17.5003 10.5C16.6719 10.5 16.0003 11.1716 16.0003 12C16.0003 12.8284 16.6719 13.5 17.5003 13.5C18.3286 13.4998 19.0003 12.8283 19.0003 12C19.0003 11.1717 18.3286 10.5002 17.5003 10.5Z" fill="currentColor"/></svg></span> <span class="lbl">Chat général</span><span class="gchat-badge" hidden></span>'
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
  // admins : liste publique servie par la base (pseudos réservés côté serveur)
  var adminNames = {}, amAdmin = false
  function isAdm(n) { return !!adminNames[String(n || '').toLowerCase()] }
  function recolor() { list.querySelectorAll('.gchat-msg>b').forEach(function (b) { b.classList.toggle('adm', isAdm(b.dataset.name)) }) }
  function sys(text) { add({ key: 'sys' + Date.now() + Math.random(), name: 'Chat', msg: text, at: new Date().toISOString() }) }
  function removeMsg(id) { var e = list.querySelector('.gchat-msg[data-id="' + id + '"]'); if (e) e.remove() }
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
    if (m.id) el.dataset.id = m.id
    var b = document.createElement('b'); b.textContent = m.name; b.dataset.name = m.name
    if (isAdm(m.name)) b.classList.add('adm')
    if (m.id) {
      // boutons de modération (visibles seulement pour l'admin ; le serveur refuse tout autre compte)
      var mod = document.createElement('span'); mod.className = 'gchat-mod'
      ;[['<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><pathd="M14.876 10.2891C17.2815 10.2054 18.4841 10.1634 19.1094 10.876C19.7347 11.5886 19.5423 12.7465 19.1562 15.0625L18.835 16.9863C18.4359 19.3808 18.2367 20.5781 17.3975 21.2891C16.5582 22 15.3444 22 12.917 22H11.082C8.65486 22 7.44074 22 6.60156 21.2891C5.76256 20.5781 5.5631 19.3805 5.16406 16.9863L4.84375 15.0625C4.45778 12.7467 4.26459 11.5886 4.88965 10.876C5.51497 10.1633 6.71833 10.2054 9.12402 10.2891C10.0581 10.3216 11.0413 10.3428 12 10.3428C12.9587 10.3428 13.9418 10.3216 14.876 10.2891ZM8.5 12C7.94775 12 7.50001 12.4477 7.5 13V19C7.5 19.5523 7.94774 20 8.5 20C9.05215 19.9998 9.5 19.5522 9.5 19V13C9.49999 12.4478 9.05215 12.0002 8.5 12ZM12 12C11.4477 12 11 12.4477 11 13V19C11 19.5523 11.4477 20 12 20C12.5522 19.9998 13 19.5522 13 19V13C13 12.4478 12.5521 12.0002 12 12ZM15.5 12C14.9477 12 14.5 12.4477 14.5 13V19C14.5 19.5523 14.9477 20 15.5 20C16.0522 19.9998 16.5 19.5522 16.5 19V13C16.5 12.4478 16.0521 12.0002 15.5 12ZM12 2C13.2752 2 14.271 2.27648 14.9707 2.85449C15.6924 3.45088 15.9479 4.2418 15.9922 4.93652C16.0162 5.31286 15.9793 5.67654 15.9189 6H18.6494C19.3953 6.00014 19.9999 6.60474 20 7.35059C20 8.01305 19.5206 8.57368 18.8623 8.64746C17.5465 8.79493 15.1509 9 12 9C8.8491 9 6.4535 8.79493 5.1377 8.64746C4.47935 8.57368 4 8.01305 4 7.35059C4.00014 6.60474 4.60474 6.00014 5.35059 6H8.08105C8.02072 5.67654 7.98384 5.31286 8.00781 4.93652C8.05208 4.2418 8.30763 3.45088 9.0293 2.85449C9.729 2.27648 10.7248 2 12 2ZM12 4C10.9822 4 10.5121 4.22356 10.3037 4.39551C10.1178 4.54906 10.0234 4.75842 10.0039 5.06348C9.9847 5.36497 10.0475 5.70063 10.1367 6H13.8633C13.9525 5.70063 14.0153 5.36497 13.9961 5.06348C13.9766 4.75842 13.8822 4.54906 13.6963 4.39551C13.4879 4.22356 13.0178 4 12 4Z"fill="currentColor" /></svg></span>', 'Supprimer le message', function () {
        client.rpc('admin_chat_delete', { p_id: m.id }).then(function (r) {
          if (r.error) return sys('Suppression refusée.')
          removeMsg(m.id)
          channel.send({ type: 'broadcast', event: 'del', payload: { id: m.id } })
        })
      }], ['<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.44336 3.92188C10.1406 3.71986 10.8927 3.91175 11.4082 4.42285C11.9997 5.00957 12 6.84976 12 10.5293V13.4697C12 17.1496 11.9997 18.9894 11.4082 19.5762C10.8927 20.0875 10.1408 20.2792 9.44336 20.0772C8.71927 19.8672 7.92887 18.5249 6.47949 15.8779C6.18343 15.3372 5.61645 15 5 15C4.06812 15 3.60192 14.9999 3.23438 14.8477C2.74455 14.6447 2.35536 14.2554 2.15234 13.7656C2.00012 13.3981 2 12.9317 2 12C2 11.0681 2.0001 10.6019 2.15234 10.2344C2.3553 9.74447 2.7445 9.35536 3.23438 9.15235C3.60192 9.00011 4.06812 9 5 9C5.61645 9 6.18344 8.66278 6.47949 8.12207C7.92896 5.47474 8.71923 4.1317 9.44336 3.92188Z" fill="currentColor"/></svg></span>', 'Rendre muet 1 h', function () { mute(m.id, 60) }], ['<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.44336 3.92188C10.1406 3.71986 10.8927 3.91175 11.4082 4.42285C11.9997 5.00957 12 6.84976 12 10.5293V13.4697C12 17.1496 11.9997 18.9894 11.4082 19.5762C10.8927 20.0875 10.1408 20.2792 9.44336 20.0772C8.71927 19.8672 7.92887 18.5249 6.47949 15.8779C6.18343 15.3372 5.61645 15 5 15C4.06812 15 3.60192 14.9999 3.23438 14.8477C2.74455 14.6447 2.35536 14.2554 2.15234 13.7656C2.00012 13.3981 2 12.9317 2 12C2 11.0681 2.0001 10.6019 2.15234 10.2344C2.3553 9.74447 2.7445 9.35536 3.23438 9.15235C3.60192 9.00011 4.06812 9 5 9C5.61645 9 6.18344 8.66278 6.47949 8.12207C7.92896 5.47474 8.71923 4.1317 9.44336 3.92188Z" fill="currentColor"/><path d="M18.2559 4.9961C18.8105 4.585 19.5928 4.70126 20.0039 5.25586C21.4153 7.16 22.25 9.4866 22.25 12C22.25 14.5134 21.4153 16.84 20.0039 18.7441C19.5928 19.2987 18.8104 19.4149 18.2559 19.0039C17.7013 18.5928 17.5851 17.8105 17.9961 17.2559C19.106 15.7585 19.75 13.9483 19.75 12C19.75 10.0517 19.106 8.24148 17.9961 6.74414C17.585 6.18955 17.7013 5.40721 18.2559 4.9961Z" fill="currentColor"/><path d="M14.2559 7.9961C14.8105 7.585 15.5928 7.70126 16.0039 8.25586C16.785 9.30963 17.25 10.602 17.25 12C17.25 13.398 16.785 14.6904 16.0039 15.7441C15.5928 16.2987 14.8104 16.4149 14.2559 16.0039C13.7013 15.5928 13.5851 14.8105 13.9961 14.2559C14.4756 13.6089 14.75 12.8328 14.75 12C14.75 11.1672 14.4756 10.3911 13.9961 9.74414C13.585 9.18955 13.7013 8.40721 14.2559 7.9961Z" fill="currentColor"/></svg></span>', 'Lever le mute', function () { mute(m.id, 0) }]].forEach(function (a) {
        var x = document.createElement('button'); x.type = 'button'; x.innerHTML = a[0]; x.title = a[1]; x.onclick = a[2]; mod.appendChild(x)
      })
      el.appendChild(mod)
    }
    if (m.game) { var g = document.createElement('small'); g.textContent = '(' + String(m.game).slice(0, 20) + ')'; b.appendChild(g) }
    el.appendChild(t); el.appendChild(b); el.appendChild(document.createTextNode(m.msg))
    list.appendChild(el)
    while (list.children.length > 150) list.firstChild.remove()
    if (atBottom || fromHistory) scrollDown()
    if (!fromHistory && !visible()) setUnread(unread + 1)
  }

  var client = null, channel = null, last = 0, ready = null
  form.onsubmit = function (e) {
    e.preventDefault()
    var msg = input.value.trim().slice(0, MAX)
    if (!msg || !channel || Date.now() - last < 1000) return
    last = Date.now()
    input.value = ''
    // le serveur signe le message avec le pseudo du compte ; il revient ici en direct depuis la table
    // identité créée seulement au premier envoi (le Casino l'a en général déjà créée)
    ready = ready || client.auth.getSession().then(function (r) {
      if (r.data && r.data.session) return
      return client.auth.signInAnonymously()
    }).catch(function (e) { ready = null; throw e })
    ready.then(function () {
      return client.rpc('chat_say', { p_msg: msg, p_game: myGame(), p_name: myName() })
    }).then(function (r) {
      if (r && r.error) add({ key: 'err' + last, name: 'Chat', msg: r.error.message.indexOf('banni') >= 0 ? 'Compte banni.' : r.error.message.indexOf('muet') >= 0 ? 'Tu es muet pour le moment.' : 'Message non envoyé.', at: new Date().toISOString() })
    })
  }
  function mute(id, minutes) {
    client.rpc('admin_chat_mute', { p_id: id, p_minutes: minutes }).then(function (r) {
      if (r.error) return sys('Refusé : ' + r.error.message)
      sys(minutes > 0 ? r.data + ' est muet pendant ' + minutes + ' min.' : r.data + ' peut de nouveau écrire.')
    })
  }

  function start() {
    // même client que le Casino et le Monopoly (compte ou identité anonyme automatique)
    client = window.PortfolioAccount.sb

    client.from('global_chat').select('id,name,msg,game,created_at').order('id', { ascending: false }).limit(60).then(function (r) {
      ;(r.data || []).reverse().forEach(function (row) { add({ key: 'db' + row.id, id: row.id, name: row.name, game: row.game, msg: row.msg, at: row.created_at }, true) })
    })
    client.rpc('public_admins').then(function (r) {
      ;(r.data || []).forEach(function (a) { if (a.pseudo) adminNames[a.pseudo.toLowerCase()] = true })
      recolor()
    })
    // rôle admin vérifié par le serveur (aucun indicateur local n'est cru)
    client.auth.getSession().then(function (r) {
      if (!r.data || !r.data.session) return
      return client.rpc('is_admin').then(function (x) { amAdmin = x.data === true; panel.classList.toggle('gchat-admin', amAdmin) })
    })
    var me = Math.random().toString(36).slice(2)
    channel = client.channel('casino-global-chat', { config: { broadcast: { self: false }, presence: { key: me } } })
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_chat' }, function (p) {
      var row = p.new
      if (row) add({ key: 'db' + row.id, id: row.id, name: row.name, game: row.game, msg: row.msg, at: row.created_at })
    })
    // message supprimé par l'admin : on revérifie en base avant de le retirer (une annonce falsifiée ne suffit pas)
    channel.on('broadcast', { event: 'del' }, function (p) {
      var id = p && p.payload && Number(p.payload.id)
      if (!id) return
      client.from('global_chat').select('id').eq('id', id).then(function (r) { if (r.data && !r.data.length) removeMsg(id) })
    })
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
    if (window.PortfolioAccount) return start()
    window.addEventListener('portfolio-account', start, { once: true })
    setTimeout(function () {
      if (!client) { online.lastChild.textContent = 'hors ligne'; sendBtn.disabled = true }
    }, 15000)
  }
  if (document.body) boot()
  else document.addEventListener('DOMContentLoaded', boot)
})()
