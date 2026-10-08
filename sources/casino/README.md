# Casino 3D (sources)

Blackjack + roulette européenne, React + three.js, multijoueur via Supabase Realtime.
Le build sort directement dans `/jeux` du portfolio.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # écrit dans ../../jeux
```

## Arborescence

```
src/
  main.jsx, App.jsx, GameScreen.jsx   point d'entrée, choix du contrôleur, écran de jeu
  styles/app.css
  lib/        supabase, random.org, portefeuille (localStorage), sons, helpers
  net/        canal Realtime (salles) + contrôleurs hôte / client
  ui/         composants partagés : lobby, barre du haut, solde, modale RNG, toast AFK
  games/
    blackjack/  cards, engine (règles pures), host, api (stats Supabase), three/, ui/
    roulette/   rules (mises, roue), engine (règles pures), host, chips, three/, ui/
public/monopoly-card.js   carte Monopoly injectée dans le lobby (script séparé)
```

Les moteurs (`engine.js`) sont des fonctions pures sur l'état de la partie ;
les classes `*Host` (net/controller.js) les pilotent, gèrent les timers et diffusent l'état aux clients.
