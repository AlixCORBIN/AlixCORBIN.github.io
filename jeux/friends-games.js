// Section "Jeux des copains" sous les jeux du hub Casino, indépendante du bundle React
// (même principe que monopoly-card.js : ne pas patcher app.js).
(function () {
  var FRIENDS = [
    {
      title: 'Jeton', author: 'Antoine Rioul', url: 'https://www.antlabs.fr/jeton',
      icon: '🪙', hue: '#7a5a14', tag: 'Casino gratuit',
      desc: 'Clone de Stake jouable avec de faux jetons, aucun argent réel.'
    },
    {
      title: 'RNG World', author: 'Alexandre Tricot', url: 'https://rngworld.github.io/',
      icon: '🌍', hue: '#1f4f7a', tag: 'RNG quotidien',
      desc: 'Chaque jour, drop une ville aléatoire. Plus elle est rare, plus elle rapporte.'
    }
  ]
  function inject() {
    var games = document.querySelector('.games')
    if (!games || document.querySelector('[data-friends]')) return
    var wrap = document.createElement('section')
    wrap.setAttribute('data-friends', '')
    wrap.innerHTML =
      '<h2 style="font:700 18px var(--serif);margin:18px 0 2px;color:var(--gold)">Jeux des copains</h2>' +
      '<p style="font-size:12px;opacity:.65;margin:0 0 10px">Pas faits par moi : des projets d\'amis, à découvrir.</p>'
    var grid = document.createElement('div')
    grid.className = 'games'
    FRIENDS.forEach(function (g) {
      var d = document.createElement('div')
      d.className = 'game'
      d.style.setProperty('--hue', g.hue)
      d.style.borderStyle = 'dashed'
      d.innerHTML =
        '<div class="gicon">' + g.icon + '</div><h3>' + g.title + '</h3>' +
        '<small>' + g.tag + ' · par ' + g.author + '</small><p>' + g.desc + '</p>' +
        '<div class="row"><a class="btn" style="display:block;text-align:center;text-decoration:none;color:inherit" target="_blank" rel="noopener" href="' + g.url + '">Jouer ↗</a></div>'
      grid.appendChild(d)
    })
    wrap.appendChild(grid)
    games.parentNode.insertBefore(wrap, games.nextSibling)
  }
  new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true })
  inject()
})()
