// Campagne de la saison 2 : 5 mondes × 5 maps (notation : voir lib.mjs). L'ordre de la liste donne s2-01 … s2-25 ;
// le monde vient de la position (5 maps par monde, mondes S2 de physics.js : Atelier, Stratosphère, Mesa rouge, Banquise, Archipel).
// figure = figure signature ; slow = { étiquette : vitesse max du pilote auto (m/s) } ; altSlow = idem pour un raccourci.
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
];
