# Casino 3D (sources)

Blackjack, roulette européenne, Loup-Garou et UNO, React + three.js, multijoueur via Supabase Realtime.
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
    werewolf/   roles, engine (règles pures + vue filtrée par joueur), bots, host, api (stats), three/, ui/ (chat)
    uno/        cards (paquet, points), engine (règles pures + vue filtrée), bots, host, api (stats), three/ (cartes animées), ui/
public/monopoly-card.js   carte Monopoly injectée dans le lobby (script séparé)
```

Les moteurs (`engine.js`) sont des fonctions pures sur l'état de la partie ;
les classes `*Host` (net/controller.js) les pilotent, gèrent les timers et diffusent l'état aux clients.

## UNO

Règles officielles : +2, +4 (bluff défiable : 6 cartes si le défi échoue, 4 pour le bluffeur s'il réussit),
passe, inversion (rejoue à 2 joueurs), UNO! avec pénalité de 2 cartes si un joueur le laisse oublier, manches
avec décompte des points (0, 200 ou 500 points). Option : cumul des +2 / +4 (désactive alors le défi).
Un joueur absent 3 tours de suite est remplacé par un bot. Stats : `supabase/uno-stats.sql` (RPC `save_uno_game`,
`get_uno_leaderboard`, clés `un_*` dans `get_stats_summary`).
