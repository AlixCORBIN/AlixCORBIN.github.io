# Casino 3D (sources)

Blackjack, roulette européenne, Loup-Garou, UNO et Turbo Rush (course), React + three.js, multijoueur via Supabase Realtime.
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
    milleborne/ cards (106 cartes), engine (règles pures + vue filtrée), bots, host (rythme des animations), sfx (bruitages), three/ (circuit, voitures), ui/
    racing/     track (blocs, sol), physics (pas fixe 100 Hz), session, maps (25 officielles), api (records), three/, ui/ (menu, course, éditeur)
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

## Mii

Les joueurs sont représentés par leur Mii, créé dans la chaîne Mii du portfolio (`/mii`).
Le code 3D est partagé : `vite.config.js` expose `../../mii/lib` sous l'alias `@mii`, et `src/ui/MiiAvatar.jsx` l'affiche dans les scènes.
L'hôte diffuse les Mii de la salle (message `miis`), les bots reçoivent un Mii stable tiré de leur id.
Comptes facultatifs (e-mail / mot de passe ou Google) via Supabase Auth : tables `user_miis` et `user_mii_settings` (`supabase/mii-accounts.sql`).

## Turbo Rush

Course 3D contre la montre façon Trackmania, en solo : 5 mondes × 5 pistes (Stadium, Canyon, Glacier, Forêt, Néon).
Physique Rapier (`@dimforge/rapier3d-compat`, chargé à la demande) : châssis rigide, 4 roues à suspensions (contrôleur de
véhicule à rayons), appui aéro, adhérence renforcée sur les murs et dans les loopings, surfaces (route, terre, glace, turbo).
Blocs balayés le long d'un chemin 3D (`blocks.js`) : droites, virages (normaux, relevés, grands), pentes, montée longue,
tremplin, looping, wallride, plateforme ; chaque bloc sert au rendu, à la collision et à l'éditeur.
Les maps officielles sont écrites au format « tortue » dans `maps.js`.
`node tools/racing-check.mjs --write` les fait rouler par un pilote automatique sur la vraie physique (faisabilité, chevauchements)
et régénère les temps auteur. `--path "S3 O S2 F S"` teste une piste à la volée.
Éditeur : grille de blocs sur plusieurs niveaux, test obligatoire avant publication. Maps publiées et records
(meilleur temps par pseudo et par map, avec fantôme) dans Supabase : `supabase/racing.sql`.
