// Objets du Buckshot : nom, icône, description et poids de tirage.
export const ITEMS = {
  loupe: { name: "Loupe", icon: "🔍", desc: "Montre la cartouche engagée (à toi seul).", w: 3 },
  biere: { name: "Bière", icon: "🍺", desc: "Éjecte la cartouche engagée sans tirer.", w: 3 },
  cigarettes: { name: "Cigarettes", icon: "🚬", desc: "Rend 1 charge.", w: 2 },
  scie: { name: "Scie", icon: "🪚", desc: "Canon scié : le prochain tir réel fait 2 dégâts.", w: 2 },
  menottes: { name: "Menottes", icon: "⛓️", desc: "La cible passe son prochain tour.", w: 2, target: true },
  inverseur: { name: "Inverseur", icon: "🔄", desc: "Inverse la cartouche engagée (réelle ↔ à blanc).", w: 2 },
  telephone: { name: "Téléphone", icon: "📱", desc: "Une voix te révèle une cartouche à venir.", w: 2 },
  medicament: { name: "Médicament périmé", icon: "💊", desc: "40 % : +2 charges. 60 % : −1 charge.", w: 1 },
  adrenaline: { name: "Adrénaline", icon: "💉", desc: "Vole un objet adverse et l'utilise aussitôt.", w: 2, target: true },
  telecommande: { name: "Télécommande", icon: "📡", desc: "Inverse le sens du jeu (3 joueurs et plus).", w: 1 },
};

export const ITEM_IDS = Object.keys(ITEMS);
