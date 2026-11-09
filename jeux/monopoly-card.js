// Ajoute la carte Monopoly 3D au hub Casino, indépendamment du bundle React
// (le bundle est recompilé régulièrement : ne pas patcher app.js).
(function () {
  // Stockage indisponible (navigation privée) : null, on retombe sur 'Joueur'
  function savedName() { try { return (localStorage.getItem('mono-name') || '').trim() } catch (e) { return null } }
  function pseudo() {
    var inp = document.querySelector('.hub input:not([maxlength="5"])') || document.querySelector('.hub input')
    var v = inp && inp.value.trim()
    if (!v) v = savedName()
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
      '<div class="gicon"><span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><pathd="M17.635 18.143c.754 0 1.365.61 1.365 1.364 0 .658-.469 1.218-1.122 1.3-1.175.145-3.219.336-5.878.336-2.659 0-4.704-.19-5.879-.337-.652-.08-1.12-.64-1.12-1.299 0-.753.61-1.364 1.364-1.364h11.27zM11.126 3.717a1 1 0 011.748 0l3.335 6.002a1 1 0 001.702.075l1.551-2.295c.6-.888 1.987-.34 1.817.718l-1.008 6.245a2 2 0 01-1.974 1.681H5.703a2 2 0 01-1.974-1.681L2.722 8.217C2.552 7.16 3.938 6.611 4.537 7.5l1.551 2.295a1 1 0 001.703-.075l3.335-6.002z"fill="currentColor" /></svg></span></div><h3>Monopoly 3D</h3><small>2 à 8 joueurs · bots</small>' +
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
