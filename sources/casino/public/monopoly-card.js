// Ajoute la carte Monopoly 3D au hub Casino, indépendamment du bundle React
// (le bundle est recompilé régulièrement : ne pas patcher app.js).
(function () {
  function pseudo() {
    var inp = document.querySelector('.hub input:not([maxlength="5"])') || document.querySelector('.hub input')
    var v = inp && inp.value.trim()
    if (!v) try { v = (localStorage.getItem('mono-name') || '').trim() } catch (e) {}
    return v && v.length >= 2 ? v : 'Joueur'
  }
  function go(mode) {
    location.href = '../monopoly/index.html?mode=' + mode + '&name=' + encodeURIComponent(pseudo())
  }
  function inject() {
    var games = document.querySelector('.games')
    if (!games || games.querySelector('[data-monopoly]')) return
    var d = document.createElement('div')
    d.className = 'game'
    d.setAttribute('data-monopoly', '')
    d.style.setProperty('--hue', '#1f6b3a')
    d.innerHTML =
      '<div class="gicon">🎩</div><h3>Monopoly 3D</h3><small>2 à 8 joueurs · bots</small>' +
      '<p>Plateau Paris en 3D, enchères, échanges, maisons, hôtels.</p>' +
      '<div class="row"><button class="btn primary">Solo</button><button class="btn">Créer une salle</button></div>'
    var b = d.querySelectorAll('button')
    b[0].onclick = function () { go('solo') }
    b[1].onclick = function () { go('host') }
    games.appendChild(d)
  }
  new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true })
  inject()
})()
