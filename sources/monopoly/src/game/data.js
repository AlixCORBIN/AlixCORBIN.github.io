// Plateau français classique (40 cases). Montants en €.
export const GROUPS = {
  brown: { color: '#8b4a2b', house: 50 },
  lightblue: { color: '#9fd3f0', house: 50 },
  pink: { color: '#d63c95', house: 100 },
  orange: { color: '#f39325', house: 100 },
  red: { color: '#e3262f', house: 150 },
  yellow: { color: '#f7e11a', house: 150 },
  green: { color: '#1fa65a', house: 200 },
  darkblue: { color: '#1f4fa3', house: 200 },
}

const P = (name, price, group, rent) => ({ type: 'property', name, price, group, rent })
const S = (name) => ({ type: 'station', name, price: 200 })
const U = (name) => ({ type: 'utility', name, price: 150 })

export const SQUARES = [
  { type: 'go', name: 'Départ' },
  P('Boulevard de Belleville', 60, 'brown', [2, 10, 30, 90, 160, 250]),
  { type: 'caisse', name: 'Caisse de communauté' },
  P('Rue Lecourbe', 60, 'brown', [4, 20, 60, 180, 320, 450]),
  { type: 'tax', name: 'Impôts sur le revenu', amount: 200 },
  S('Gare Montparnasse'),
  P('Rue de Vaugirard', 100, 'lightblue', [6, 30, 90, 270, 400, 550]),
  { type: 'chance', name: 'Chance' },
  P('Rue de Courcelles', 100, 'lightblue', [6, 30, 90, 270, 400, 550]),
  P('Avenue de la République', 120, 'lightblue', [8, 40, 100, 300, 450, 600]),
  { type: 'jail', name: 'Prison' },
  P('Boulevard de la Villette', 140, 'pink', [10, 50, 150, 450, 625, 750]),
  U("Compagnie d'électricité"),
  P('Avenue de Neuilly', 140, 'pink', [10, 50, 150, 450, 625, 750]),
  P('Rue de Paradis', 160, 'pink', [12, 60, 180, 500, 700, 900]),
  S('Gare de Lyon'),
  P('Avenue Mozart', 180, 'orange', [14, 70, 200, 550, 750, 950]),
  { type: 'caisse', name: 'Caisse de communauté' },
  P('Boulevard Saint-Michel', 180, 'orange', [14, 70, 200, 550, 750, 950]),
  P('Place Pigalle', 200, 'orange', [16, 80, 220, 600, 800, 1000]),
  { type: 'parking', name: 'Parc gratuit' },
  P('Avenue Matignon', 220, 'red', [18, 90, 250, 700, 875, 1050]),
  { type: 'chance', name: 'Chance' },
  P('Boulevard Malesherbes', 220, 'red', [18, 90, 250, 700, 875, 1050]),
  P('Avenue Henri-Martin', 240, 'red', [20, 100, 300, 750, 925, 1100]),
  S('Gare du Nord'),
  P('Faubourg Saint-Honoré', 260, 'yellow', [22, 110, 330, 800, 975, 1150]),
  P('Place de la Bourse', 260, 'yellow', [22, 110, 330, 800, 975, 1150]),
  U('Compagnie des eaux'),
  P('Rue La Fayette', 280, 'yellow', [24, 120, 360, 850, 1025, 1200]),
  { type: 'gotojail', name: 'Allez en prison' },
  P('Avenue de Breteuil', 300, 'green', [26, 130, 390, 900, 1100, 1275]),
  P('Avenue Foch', 300, 'green', [26, 130, 390, 900, 1100, 1275]),
  { type: 'caisse', name: 'Caisse de communauté' },
  P('Boulevard des Capucines', 320, 'green', [28, 150, 450, 1000, 1200, 1400]),
  S('Gare Saint-Lazare'),
  { type: 'chance', name: 'Chance' },
  P('Avenue des Champs-Élysées', 350, 'darkblue', [35, 175, 500, 1100, 1300, 1500]),
  { type: 'tax', name: 'Taxe de luxe', amount: 100 },
  P('Rue de la Paix', 400, 'darkblue', [50, 200, 600, 1400, 1700, 2000]),
]

export const BUYABLE = SQUARES.map((s, i) => (s.price ? i : -1)).filter((i) => i >= 0)
export const groupMembers = (g) => SQUARES.map((s, i) => (s.group === g ? i : -1)).filter((i) => i >= 0)
export const STATIONS = [5, 15, 25, 35]
export const UTILITIES = [12, 28]

// Cartes : kind = money | move | moveRel | jail | jailCard | repairs | each
export const CHANCE = [
  { text: 'Avancez jusqu’à la case Départ.', kind: 'move', to: 0 },
  { text: 'Rendez-vous Rue de la Paix.', kind: 'move', to: 39 },
  { text: 'Rendez-vous Avenue Henri-Martin. Si vous passez par la case Départ, recevez 200 €.', kind: 'move', to: 24 },
  { text: 'Avancez au Boulevard de la Villette. Si vous passez par la case Départ, recevez 200 €.', kind: 'move', to: 11 },
  { text: 'Allez à la Gare de Lyon. Si vous passez par la case Départ, recevez 200 €.', kind: 'move', to: 15 },
  { text: 'Reculez de trois cases.', kind: 'moveRel', n: -3 },
  { text: 'Allez en prison. Ne passez pas par la case Départ.', kind: 'jail' },
  { text: 'La banque vous verse un dividende de 50 €.', kind: 'money', amount: 50 },
  { text: 'Vous êtes libéré de prison. Conservez cette carte.', kind: 'jailCard' },
  { text: 'Réparations : 25 € par maison, 100 € par hôtel.', kind: 'repairs', house: 25, hotel: 100 },
  { text: 'Amende pour excès de vitesse : 15 €.', kind: 'money', amount: -15 },
  { text: 'Votre immeuble et votre prêt rapportent. Recevez 150 €.', kind: 'money', amount: 150 },
  { text: 'Vous avez gagné le concours de mots croisés. Recevez 100 €.', kind: 'money', amount: 100 },
  { text: 'Amende pour ivresse : 20 €.', kind: 'money', amount: -20 },
  { text: 'Payez pour frais de scolarité : 150 €.', kind: 'money', amount: -150 },
  { text: 'Vous êtes élu président du conseil. Versez 50 € à chaque joueur.', kind: 'each', amount: -50 },
]

export const CAISSE = [
  { text: 'Avancez jusqu’à la case Départ.', kind: 'move', to: 0 },
  { text: 'Erreur de la banque en votre faveur. Recevez 200 €.', kind: 'money', amount: 200 },
  { text: 'Payez la note du médecin : 50 €.', kind: 'money', amount: -50 },
  { text: 'La vente de votre stock vous rapporte 50 €.', kind: 'money', amount: 50 },
  { text: 'Vous êtes libéré de prison. Conservez cette carte.', kind: 'jailCard' },
  { text: 'Allez en prison. Ne passez pas par la case Départ.', kind: 'jail' },
  { text: 'Retournez au Boulevard de Belleville.', kind: 'move', to: 1, noGo: true },
  { text: 'Recevez votre revenu annuel : 100 €.', kind: 'money', amount: 100 },
  { text: 'Remboursement des contributions : 20 €.', kind: 'money', amount: 20 },
  { text: 'C’est votre anniversaire : chaque joueur vous donne 10 €.', kind: 'each', amount: 10 },
  { text: 'Votre assurance-vie arrive à échéance. Recevez 100 €.', kind: 'money', amount: 100 },
  { text: 'Payez l’hôpital : 100 €.', kind: 'money', amount: -100 },
  { text: 'Payez votre police d’assurance : 50 €.', kind: 'money', amount: -50 },
  { text: 'Vous héritez de 100 €.', kind: 'money', amount: 100 },
  { text: 'Deuxième prix de beauté : recevez 10 €.', kind: 'money', amount: 10 },
  { text: 'Réparations de voirie : 40 € par maison, 115 € par hôtel.', kind: 'repairs', house: 40, hotel: 115 },
]

export const PLAYER_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00']
export const PAWNS = ['chapeau', 'cone', 'diamant', 'cube', 'anneau', 'etoile']
export const BOT_NAMES = ['Bot Gaston', 'Bot Mireille', 'Bot Hector', 'Bot Louise', 'Bot Marcel']
export const START_MONEY = 1500
export const GO_SALARY = 200
export const JAIL_FINE = 50
