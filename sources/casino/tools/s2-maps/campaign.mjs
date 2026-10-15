// Campagne de la saison 2 : 5 mondes × 5 maps (notation : voir lib.mjs). L'ordre de la liste donne s2-01 … s2-25 ;
// le monde vient de la position (5 maps par monde, mondes S2 de physics.js : Atelier, Stratosphère, Mesa rouge, Banquise, Archipel).
// figure = figure signature ; slow = { étiquette : vitesse max du pilote auto (m/s) } ; altSlow = idem pour un raccourci ;
// ground = { relief } : map posée sur un sol (dunes de relief niveaux, 0 = plat) au lieu du vide.
export const MAPS = [
  // ---------- Monde 1 · Atelier (tech) ----------
  {
    name: "Établi", figure: "Escalier d'épingles",
    slow: { P: 14, M: 14 }, altSlow: { A: { P: 60, M: 60 } },
    path: `S Sn Sn chicane S C
      slopeg hairpin slopeg !hairpin slopeg C
      #P X @f <A >R S !turn S S S !turn S A> #M X >R
      S bankx:r=1 Sn !slopeg !slopeg C !turn S !cliff S chicane:side=1 S hairpin Sb Sb F S
      =f {A Sn kicker2:angle=12 _ }`,
  },
  {
    name: "Engrenages", figure: "S de virages relevés à 45°",
    slow: { P: 13, CL: 14 },
    path: `S Sn bankx:r=1 !bankx:r=1 S camber:angle=20 C bankx:r=1 !bankx:r=1 slopeg Sb slopeg C
      #P X @f <A >L S !turn S #CL !cliff !turn S !turn S S S Sn A> !slopeg chicane S
      bankx:r=2 Sn !hairpin slopeg Sb C camber:angle=25,side=1 S !turn Sb F S
      =f {A cut }`,
  },
  {
    name: "Laminoir", figure: "Mur long (entrée, mur, sortie)",
    slow: { P: 13, M: 13, WR: 40, WO: 36 }, altSlow: { A: { P: 60, J: 27, M: 60 } },
    path: `S Sn whoops S C turnw:r=2 slopeg pipe S C
      #P X @f <A >R S !turn steep S !turn S A> #M X >R
      S wallin #WR wallrun #WO wallout S C !turnw:r=2 !slopeg !slopeg bump:h=3 Sb !cliff S hairpin Sn chicane:side=1 Sb !slopeg F S
      =f {A #J jet:power=38 _ }`,
  },
  {
    name: "Presse", figure: "Barrière cyclique et porte à interrupteur",
    slow: { P: 13 },
    path: `S Sn gate:period=300,closed=100 S C switch:id=1 S bankx:r=2 revboost S slopeg slopeg chicane C
      #P X @f <A >R S hairpin !steep turn S S A> S door:id=1 Sn
      !bankx:r=1 S !slopeg cpfast:minSpeed=60 S !hairpin Sb whoops C turn Sn !steep S F S
      =f {A Sb }`,
  },
  {
    name: "Chaîne de montage", figure: "Tunnel à l'envers",
    slow: { P: 13, M: 13 }, altSlow: { A: { P: 60, K: 33, M: 25 } },
    path: `S Sn B tunnel:len=1 S C !bankx:r=1 slopeg Sb camber:angle=15 C
      #P X @f <A >L S turn !slopeg S turn S A> #M X >L
      S hloop S Sn C turn Sb !cliff chicane S !bankx:angle=70,r=2 Sn slopeg whoops C !turn S !steep Sb F S
      =f {A Sb #K kicker2:angle=15 _ Y }`,
  },
  // ---------- Monde 2 · Stratosphère (fullspeed) ----------
  {
    name: "Décollage", figure: "Long saut au turbo",
    slow: { P: 16, M: 16 }, altSlow: { A: { P: 70 } },
    path: `S B S turnw:r=2 slopeg C bankx:r=2 slopeg B:level=3 kicker2:angle=16,len=2 _ _ _ Y Y S C
      !turnw:r=3 slopeg B slopeg #P X @f <A >L !cliff turnw:r=2 turn S Sb S A> #M X >L
      B Sn bankx:r=2 !slopeg C S turnw:r=2 chicane B:level=1 Sb turnw:r=3 slopeg Sn bankx:r=1 S F S
      =f {A cut }`,
  },
  {
    name: "Jet-stream", figure: "Spirale relevée à 70°",
    slow: { P: 18, M: 16 }, altSlow: { A: { P: 70 } },
    path: `S B Sn slopeg C bankx:angle=70,r=2 slopeg bankx:angle=70,r=2 slopeg bankx:angle=70,r=2 slopeg bankx:angle=70,r=2
      Sn C B:level=1 kicker2:angle=12 _ Y Sb S B:level=2 bump:h=3 Sn !turnw:r=2 #P X @f <A >R !bankx:r=1 !bankx:r=1 A> #M X >R
      B Sn !slopeg C S Sb B:level=3 kicker2:angle=14 _ _ Y Y bare turnw:r=2 Sb F S
      =f {A bump:h=6 _ }`,
  },
  {
    name: "Cumulus", figure: "Loopings enchaînés au turbo",
    slow: { P: 18, M: 16 }, altSlow: { A: { P: 70, J: 40 } },
    path: `S B S loop B loop C Sb turnw:r=2 B jet:power=34 _ ^ ^ S C
      bankx:r=2 slopeg #P X @f <A >L Sb turn steep Sn turn S A> #M X >L
      B chicane !slopeg C bankx:angle=70,r=2 Sn B kicker2:angle=12,len=2 _ _ _ Y Y Y !slopeg !turnw:r=3 B:level=1 slopeg Sn bump:h=3 Sb F S
      =f {A #J jet:power=38 _ }`,
  },
  {
    name: "Tropopause", figure: "Escalier de réacteurs",
    slow: { P: 16, M: 16 }, altSlow: { A: { P: 34, M: 30 } },
    path: `S B Sn jet:power=34 _ ^ ^ Sb jet:power=34 _ ^ ^ C turnw:r=2 B:level=1 jet:power=34 _ ^ ^ S C
      bump:h=2 #P X @f <A >R S !turn !steep Sb !turn S A> #M X >R
      B Sn bankx:angle=70,r=3 B:level=3 kicker2:angle=13,len=2 _ _ _ Y Y Y !slopeg Sn chicane:side=1
      bankx:angle=70,r=2 Sb !cliff C B cpfast:minSpeed=140 jet:power=30 _ ^ Sn !turnw:r=3 Sb F S
      =f {A Sn !steep }`,
  },
  {
    name: "Mur du son", figure: "Triple looping au turbo",
    slow: { P: 16, M: 16 }, altSlow: { A: { P: 60 } },
    path: `S B Sn loop B:level=1 loop B:level=1 loop C bankx:angle=70,r=2 B jet:power=40 _ ^ ^ ^ Sn C
      bankx:angle=70,r=2 slopeg Sb #P X @f <A >R S !turn S !slopeg !turn S A> #M X >R
      B cpfast:minSpeed=150 Sn B:level=3 kicker2:angle=16,len=2 _ _ _ Y Y !slopeg C bankx:angle=70,r=2 chicane Sn F S
      =f {A Sn bump:h=5 _ Y }`,
  },
  // ---------- Monde 3 · Mesa rouge (dirt) ----------
  {
    name: "Piste rouge", figure: "Bosses de terre",
    ground: { relief: 1 }, start: { x: 0, z: 0, d: 0, l: 0 },
    path: `S B Sb/d whoops/d C turnw:r=2/d Sb/d <A !turnw:r=2/d slopeg/d hairpin/d !slopeg/d !turnw:r=2/d A> Sb/d camber:angle=20,side=1/d C
      slopeg/d bump:h=4/d slopeg/d cliff/d Sb/d C hairpin/d !cliff/d Sn/d !slopeg/d !slopeg/d F S`,
  },
  {
    name: "Lacets", figure: "Lacets d'épingles en terre",
    ground: { relief: 2 }, start: { x: 0, z: 0, d: 0, l: 0 },
    path: `S B Sb/d C slopeg/d hairpin/d slopeg/d !hairpin/d slopeg/d hairpin/d cliff/d C
      !turnw:r=2/d Sn/d camber:angle=20/d !cliff/d Sb/d !slopeg/d !slopeg/d C <A !turnw:r=2/d turnw:r=2/d Sb/d turnw:r=2/d !turnw:r=2/d A> bump:h=4/d Sb/d F S`,
  },
  {
    name: "Dunes", figure: "Saut par-dessus la dune",
    ground: { relief: 4 }, start: { x: 0, z: 0, d: 0, l: 0 },
    slow: { T: 16 }, altSlow: { A: { T: 60 } },
    path: `S B Sn/d C turnw:r=2/d slopeg/d slopeg/d B:level=2 kicker2:angle=18,len=2 _ _ _ Y Y !slopeg/d Sb/d C
      !turnw:r=2/d cliff/d Sb/d slopeg/d Sb/d #T cut/d <A !turn !cliff/d turn turn Sb/d !turn A> Sb/d whoops/d C turnw:r=3/d bump:h=3/d Sb/d F S`,
  },
  {
    name: "Corniche", figure: "Dévers en terre au-dessus du vide",
    slow: { P: 15, M: 15 }, altSlow: { A: { P: 22, M: 22 } },
    path: `S B Sn/d C turnw:r=2/d camber:angle=20/d Sb/d camber:angle=20,side=1/d slopeg/d #P X @f <A >R Sb/d !turn whoops/d !turn Sb/d A> #M X >R
      Sb/d C !hairpin/d slopeg/d slopeg/d camber:angle=30/d B:level=1 !cliff/d C turnw:r=2/d whoops/d !slopeg/d F S
      =f {A camber:angle=30/d }`,
  },
  {
    name: "Grand rallye", figure: "Épingle, saut et dévers enchaînés",
    ground: { relief: 3 }, start: { x: 0, z: 0, d: 0, l: 0 },
    path: `S B Sb/d whoops/d C turnw:r=2/d slopeg/d Sb/d slopeg/d cliff/d C hairpin/d Sn/d camber:angle=25,side=1/d
      B:level=2 kicker2:angle=16,len=2 _ _ _ Y Y Y !slopeg/d Sn/d !slopeg/d C !turnw:r=2/d bump:h=5/d Sb/d
      <A !turnw:r=2/d Sb/d bankx:r=2/d bankx:r=2/d Sb/d !turnw:r=2/d A> camber:angle=20/d C chicane/d F S`,
  },
];
