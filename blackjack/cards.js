/* * Générateur de cartes SVG
 * Permet de créer les cartes dynamiquement sans images externes.
 */

const SUITS = {
    'H': { symbol: '♥', color: '#d40000', name: 'coeur' }, // Hearts
    'D': { symbol: '♦', color: '#d40000', name: 'carreau' }, // Diamonds
    'C': { symbol: '♣', color: '#1a1a1a', name: 'trefle' }, // Clubs
    'S': { symbol: '♠', color: '#1a1a1a', name: 'pique' }  // Spades
};

/**
 * Crée le code HTML d'une carte SVG
 * @param {string} value - La valeur (2, 3, ..., 10, J, Q, K, A)
 * @param {string} suit - L'enseigne (H, D, C, S)
 * @returns {string} Le code SVG complet
 */
function createCardSVG(value, suit) {
    const s = SUITS[suit];
    
    // Design de base de la carte (rectangles arrondis)
    return `
    <svg class="card-svg" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="140" rx="10" ry="10" fill="white" stroke="#ccc" stroke-width="1"/>
        
        <text x="8" y="24" font-family="Arial" font-size="20" font-weight="bold" fill="${s.color}">${value}</text>
        <text x="8" y="42" font-family="Arial" font-size="20" fill="${s.color}">${s.symbol}</text>

        <text x="50" y="85" font-family="Arial" font-size="60" text-anchor="middle" fill="${s.color}">${s.symbol}</text>

        <g transform="rotate(180, 50, 70)">
            <text x="8" y="24" font-family="Arial" font-size="20" font-weight="bold" fill="${s.color}">${value}</text>
            <text x="8" y="42" font-family="Arial" font-size="20" fill="${s.color}">${s.symbol}</text>
        </g>
    </svg>
    `;
}

/**
 * Crée le dos d'une carte (pour la carte cachée du croupier)
 */
function createBackCardSVG() {
    return `
    <svg class="card-svg" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="140" rx="10" ry="10" fill="#2c3e50" stroke="white" stroke-width="4"/>
        <rect x="10" y="10" width="80" height="120" rx="5" ry="5" fill="#34495e"/>
        <text x="50" y="80" font-family="Arial" font-size="14" fill="white" text-anchor="middle">BLACKJACK</text>
    </svg>
    `;
}